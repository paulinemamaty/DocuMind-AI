import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'
import { DocumentProcessorServiceClient } from 'https://esm.sh/@google-cloud/documentai@9.3.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BatchProcessRequest {
  documentIds: string[]
  priority?: number
  processorTypes?: string[]
  options?: {
    maxConcurrency?: number
    fieldMask?: string
    ocrHints?: string[]
  }
}

interface ProcessingResult {
  documentId: string
  status: 'success' | 'failed'
  processingTime?: number
  error?: string
  results?: {
    textLength: number
    formFields: number
    tables: number
    entities: number
  }
}

class BatchProcessor {
  private supabase: any
  private client: DocumentProcessorServiceClient
  private config: any
  private maxConcurrency: number

  constructor(supabase: any, client: DocumentProcessorServiceClient, config: any, maxConcurrency: number = 5) {
    this.supabase = supabase
    this.client = client
    this.config = config
    this.maxConcurrency = maxConcurrency
  }

  async processBatch(documentIds: string[], processorTypes: string[], options: any = {}): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = []
    const queue = [...documentIds]
    const processing = new Map<string, Promise<ProcessingResult>>()

    while (queue.length > 0 || processing.size > 0) {
      // Start new processing tasks up to max concurrency
      while (processing.size < this.maxConcurrency && queue.length > 0) {
        const documentId = queue.shift()!
        const promise = this.processDocument(documentId, processorTypes, options)
          .then(result => {
            processing.delete(documentId)
            return result
          })
          .catch(error => {
            processing.delete(documentId)
            return {
              documentId,
              status: 'failed' as const,
              error: error.message
            }
          })
        
        processing.set(documentId, promise)
      }

      // Wait for at least one to complete
      if (processing.size > 0) {
        const result = await Promise.race(processing.values())
        results.push(result)
      }
    }

    return results
  }

  private async processDocument(
    documentId: string,
    processorTypes: string[],
    options: any
  ): Promise<ProcessingResult> {
    const startTime = Date.now()

    try {
      // Get document from database
      const { data: document, error: docError } = await this.supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single()

      if (docError || !document) {
        throw new Error('Document not found')
      }

      // Update status
      await this.supabase
        .from('documents')
        .update({ status: 'processing' })
        .eq('id', documentId)

      // Download document
      const { data: fileData, error: downloadError } = await this.supabase.storage
        .from('documents')
        .download(document.file_url)

      if (downloadError || !fileData) {
        throw new Error('Failed to download document')
      }

      const arrayBuffer = await fileData.arrayBuffer()
      const documentBuffer = new Uint8Array(arrayBuffer)

      // Process with each processor type
      const processingResults: Record<string, any> = {}

      for (const processorType of processorTypes) {
        const processorId = this.config.processors[processorType]
        if (!processorId) continue

        const processorPath = `projects/${this.config.projectNumber}/locations/${this.config.location}/processors/${processorId}`

        const request: any = {
          name: processorPath,
          rawDocument: {
            content: documentBuffer,
            mimeType: document.mime_type,
          }
        }

        // Add optimizations
        if (options.fieldMask) {
          request.fieldMask = { paths: options.fieldMask.split(',') }
        }

        try {
          const [result] = await this.client.processDocument(request)
          processingResults[processorType] = result.document
        } catch (error: any) {
          console.error(`Failed ${processorType} for ${documentId}:`, error.message)
        }
      }

      const processingTime = Date.now() - startTime

      // Store results
      await this.storeResults(documentId, processingResults, processingTime)

      // Update status
      await this.supabase
        .from('documents')
        .update({
          status: 'completed',
          processing_error: null,
          metadata: {
            processingTime,
            batchProcessed: true,
            processorsUsed: processorTypes
          }
        })
        .eq('id', documentId)

      return {
        documentId,
        status: 'success',
        processingTime,
        results: {
          textLength: processingResults.ocr?.text?.length || 0,
          formFields: processingResults.formParser?.pages?.[0]?.formFields?.length || 0,
          tables: processingResults.formParser?.pages?.[0]?.tables?.length || 0,
          entities: processingResults.ocr?.entities?.length || 0
        }
      }

    } catch (error: any) {
      // Update status to failed
      await this.supabase
        .from('documents')
        .update({
          status: 'failed',
          processing_error: error.message
        })
        .eq('id', documentId)

      throw error
    }
  }

  private async storeResults(documentId: string, results: any, processingTime: number) {
    // Store extraction
    const extractionData = {
      document_id: documentId,
      full_text: results.ocr?.text || '',
      entities: JSON.stringify(results.ocr?.entities || []),
      tables: JSON.stringify(
        results.formParser?.pages?.flatMap((page: any) =>
          page.tables || []
        ) || []
      ),
      summary: results.summarizer?.text || null,
      processing_time_ms: processingTime
    }

    await this.supabase
      .from('document_extractions')
      .upsert(extractionData)

    // Store form fields
    const formFields = results.formParser?.pages?.flatMap((page: any, pageIndex: number) =>
      page.formFields?.map((field: any, fieldIndex: number) => ({
        document_id: documentId,
        field_type: 'text',
        field_name: field.fieldName?.textAnchor?.content || `field_${fieldIndex}`,
        field_label: field.fieldName?.textAnchor?.content || `Field ${fieldIndex + 1}`,
        field_value: field.fieldValue?.textAnchor?.content || '',
        confidence: field.fieldName?.confidence || 0,
        page_number: pageIndex + 1,
        coordinates: { x: 0, y: 0, width: 100, height: 20 }
      })) || []
    ) || []

    if (formFields.length > 0) {
      await this.supabase
        .from('document_form_fields')
        .delete()
        .eq('document_id', documentId)

      await this.supabase
        .from('document_form_fields')
        .insert(formFields)
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { 
      documentIds, 
      priority = 5, 
      processorTypes = ['ocr', 'formParser'],
      options = {}
    } = await req.json() as BatchProcessRequest

    if (!documentIds || documentIds.length === 0) {
      throw new Error('No documents provided')
    }

    if (documentIds.length > 50) {
      throw new Error('Maximum 50 documents per batch')
    }

    // Get processor configuration
    const config = {
      projectId: Deno.env.get('GOOGLE_CLOUD_PROJECT_ID')!,
      projectNumber: Deno.env.get('GOOGLE_CLOUD_PROJECT_NUMBER')!,
      location: Deno.env.get('GCP_LOCATION') || 'us',
      processors: {
        ocr: Deno.env.get('GCP_OCR_PROCESSOR_ID')!,
        formParser: Deno.env.get('GCP_FORM_PARSER_PROCESSOR_ID')!,
        layoutParser: Deno.env.get('GCP_LAYOUT_PARSER_PROCESSOR_ID')!,
        summarizer: Deno.env.get('GCP_SUMMARIZER_PROCESSOR_ID')!,
      }
    }

    // Initialize Document AI client
    const serviceAccountKey = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')!)
    const client = new DocumentProcessorServiceClient({
      credentials: serviceAccountKey,
      projectId: config.projectId
    })

    // Create batch processor
    const batchProcessor = new BatchProcessor(
      supabase,
      client,
      config,
      options.maxConcurrency || 5
    )

    // Process batch
    const results = await batchProcessor.processBatch(
      documentIds,
      processorTypes,
      options
    )

    // Calculate statistics
    const stats = {
      total: results.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      averageProcessingTime: results
        .filter(r => r.processingTime)
        .reduce((sum, r) => sum + r.processingTime!, 0) / 
        results.filter(r => r.processingTime).length || 0
    }

    // Trigger embeddings generation for successful documents
    const successfulDocs = results.filter(r => r.status === 'success')
    if (successfulDocs.length > 0) {
      await fetch(`${supabaseUrl}/functions/v1/batch-embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentIds: successfulDocs.map(r => r.documentId)
        })
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error('Batch processing error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})