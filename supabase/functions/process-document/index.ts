import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'
import { DocumentProcessorServiceClient } from 'https://esm.sh/@google-cloud/documentai@9.3.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProcessRequest {
  documentId: string
  priority?: number
  processorTypes?: string[]
  options?: {
    fieldMask?: string
    ocrHints?: string[]
    pageRange?: { start: number; end: number }
  }
}

interface ProcessorConfig {
  projectId: string
  projectNumber: string
  location: string
  processors: {
    ocr: string
    formParser: string
    layoutParser: string
    summarizer: string
  }
}

// Rate limiting implementation
class RateLimiter {
  private tokens: number
  private maxTokens: number
  private refillRate: number
  private lastRefill: number

  constructor(maxTokens: number = 600, refillRate: number = 600) {
    this.tokens = maxTokens
    this.maxTokens = maxTokens
    this.refillRate = refillRate // tokens per minute
    this.lastRefill = Date.now()
  }

  async acquire(tokens: number = 1): Promise<boolean> {
    this.refill()
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens
      return true
    }
    
    // Calculate wait time
    const tokensNeeded = tokens - this.tokens
    const waitTime = (tokensNeeded / this.refillRate) * 60000 // Convert to milliseconds
    
    // Wait with exponential backoff
    await this.delay(Math.min(waitTime, 30000)) // Max wait 30 seconds
    return this.acquire(tokens)
  }

  private refill() {
    const now = Date.now()
    const timePassed = now - this.lastRefill
    const tokensToAdd = (timePassed / 60000) * this.refillRate
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd)
    this.lastRefill = now
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

const rateLimiter = new RateLimiter()

// Error mapping for Document AI
const ERROR_MAP: Record<string, string> = {
  'DEADLINE_EXCEEDED': 'Document processing took too long. The document will be retried.',
  'RESOURCE_EXHAUSTED': 'Processing quota exceeded. Your document has been queued.',
  'INVALID_ARGUMENT': 'Invalid document format or corrupted file.',
  'INTERNAL': 'Document AI service error. Retrying automatically.',
  'UNAVAILABLE': 'Document AI service temporarily unavailable.',
  'PERMISSION_DENIED': 'Invalid credentials for Document AI.',
  'NOT_FOUND': 'Processor not found. Please check configuration.',
  'ALREADY_EXISTS': 'Document already being processed.',
  'FAILED_PRECONDITION': 'Document prerequisites not met.',
  'ABORTED': 'Processing was cancelled.',
  'OUT_OF_RANGE': 'Page range exceeds document pages.',
  'UNIMPLEMENTED': 'Feature not supported for this document type.',
  'DATA_LOSS': 'Partial data loss during processing.',
  'UNAUTHENTICATED': 'Authentication failed. Please check service account.'
}

async function processWithRetry(
  client: DocumentProcessorServiceClient,
  request: any,
  maxRetries: number = 3
): Promise<any> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Acquire rate limit token
      await rateLimiter.acquire()
      
      // Process document
      const [result] = await client.processDocument(request)
      return result
      
    } catch (error: any) {
      lastError = error
      const errorCode = error.code || 'UNKNOWN'
      const errorMessage = ERROR_MAP[errorCode] || error.message
      
      console.error(`Attempt ${attempt + 1} failed:`, errorMessage)
      
      // Check if error is retryable
      const retryableErrors = ['DEADLINE_EXCEEDED', 'INTERNAL', 'UNAVAILABLE', 'RESOURCE_EXHAUSTED']
      if (!retryableErrors.includes(errorCode)) {
        throw new Error(errorMessage)
      }
      
      // Exponential backoff
      if (attempt < maxRetries - 1) {
        const backoffTime = Math.min(1000 * Math.pow(2, attempt), 30000)
        await new Promise(resolve => setTimeout(resolve, backoffTime))
      }
    }
  }
  
  throw lastError
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request
    const { documentId, priority = 5, processorTypes = ['ocr', 'formParser'], options = {} } = await req.json() as ProcessRequest

    // Get document from database
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError || !document) {
      throw new Error('Document not found')
    }

    // Update status to processing
    await supabase
      .from('documents')
      .update({ 
        status: 'processing',
        processing_attempts: (document.processing_attempts || 0) + 1
      })
      .eq('id', documentId)

    // Download document from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.file_url)

    if (downloadError || !fileData) {
      throw new Error('Failed to download document')
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const documentBuffer = new Uint8Array(arrayBuffer)

    // Get processor configuration
    const processorConfig: ProcessorConfig = {
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

    // Initialize Document AI client with service account
    const serviceAccountKey = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')!)
    const client = new DocumentProcessorServiceClient({
      credentials: serviceAccountKey,
      projectId: processorConfig.projectId
    })

    const results: Record<string, any> = {}
    const startTime = Date.now()

    // Process with each requested processor
    for (const processorType of processorTypes) {
      const processorId = processorConfig.processors[processorType as keyof typeof processorConfig.processors]
      if (!processorId) continue

      const processorPath = `projects/${processorConfig.projectNumber}/locations/${processorConfig.location}/processors/${processorId}`

      // Build request with optimizations
      const request: any = {
        name: processorPath,
        rawDocument: {
          content: documentBuffer,
          mimeType: document.mime_type,
        }
      }

      // Add field mask if specified
      if (options.fieldMask) {
        request.fieldMask = { paths: options.fieldMask.split(',') }
      }

      // Add OCR hints if specified
      if (options.ocrHints && processorType === 'ocr') {
        request.processOptions = {
          ocrConfig: {
            languageHints: options.ocrHints,
            enableNativePdfParsing: true,
            enableImageQualityScores: true
          }
        }
      }

      // Add page range if specified
      if (options.pageRange) {
        request.processOptions = {
          ...request.processOptions,
          individualPageSelector: {
            pages: Array.from(
              { length: options.pageRange.end - options.pageRange.start + 1 },
              (_, i) => options.pageRange.start + i
            )
          }
        }
      }

      // Process with retry logic
      try {
        const result = await processWithRetry(client, request)
        results[processorType] = result.document
      } catch (error: any) {
        console.error(`Failed to process with ${processorType}:`, error.message)
        results[processorType] = { error: error.message }
      }
    }

    const processingTime = Date.now() - startTime

    // Merge results from all processors
    const mergedResult = {
      text: results.ocr?.text || '',
      entities: results.ocr?.entities || [],
      formFields: results.formParser?.pages?.flatMap((page: any) => 
        page.formFields?.map((field: any) => ({
          fieldName: field.fieldName?.textAnchor?.content || '',
          fieldValue: field.fieldValue?.textAnchor?.content || '',
          confidence: field.fieldName?.confidence || 0,
          pageNumber: page.pageNumber
        })) || []
      ) || [],
      tables: results.formParser?.pages?.flatMap((page: any) =>
        page.tables?.map((table: any) => ({
          headerRows: table.headerRows || [],
          bodyRows: table.bodyRows || [],
          pageNumber: page.pageNumber
        })) || []
      ) || [],
      pages: results.layoutParser?.pages || [],
      summary: results.summarizer?.text || null,
      processingTime
    }

    // Store extraction results
    const { error: extractionError } = await supabase
      .from('document_extractions')
      .upsert({
        document_id: documentId,
        full_text: mergedResult.text,
        entities: JSON.stringify(mergedResult.entities),
        tables: JSON.stringify(mergedResult.tables),
        summary: mergedResult.summary,
        processing_time_ms: processingTime
      })

    if (extractionError) {
      console.error('Failed to store extraction:', extractionError)
    }

    // Store form fields
    if (mergedResult.formFields.length > 0) {
      await supabase
        .from('document_form_fields')
        .delete()
        .eq('document_id', documentId)

      const { error: fieldsError } = await supabase
        .from('document_form_fields')
        .insert(
          mergedResult.formFields.map((field: any, index: number) => ({
            document_id: documentId,
            field_type: 'text',
            field_name: field.fieldName || `field_${index}`,
            field_label: field.fieldName || `Field ${index + 1}`,
            field_value: field.fieldValue || '',
            confidence: field.confidence,
            page_number: field.pageNumber || 1,
            coordinates: { x: 0, y: 0, width: 100, height: 20 }
          }))
        )

      if (fieldsError) {
        console.error('Failed to store form fields:', fieldsError)
      }
    }

    // Generate embeddings (trigger separate edge function)
    await fetch(`${supabaseUrl}/functions/v1/generate-embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        documentId,
        text: mergedResult.text
      })
    })

    // Update document status
    await supabase
      .from('documents')
      .update({
        status: 'completed',
        processing_error: null,
        metadata: {
          processingTime,
          processorsUsed: processorTypes,
          textLength: mergedResult.text?.length || 0,
          formFieldCount: mergedResult.formFields?.length || 0,
          tableCount: mergedResult.tables?.length || 0,
          pageCount: mergedResult.pages?.length || 0
        }
      })
      .eq('id', documentId)

    // Send webhook notification if configured
    const { data: webhook } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('event_type', 'document.processed')
      .single()

    if (webhook?.url) {
      await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'document.processed',
          documentId,
          status: 'completed',
          processingTime,
          timestamp: new Date().toISOString()
        })
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        processingTime,
        results: {
          textLength: mergedResult.text?.length || 0,
          formFields: mergedResult.formFields?.length || 0,
          tables: mergedResult.tables?.length || 0,
          entities: mergedResult.entities?.length || 0
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error('Processing error:', error)
    
    // Update document status to failed
    if (req.json && (await req.json()).documentId) {
      const { documentId } = await req.json()
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      await supabase
        .from('documents')
        .update({
          status: 'failed',
          processing_error: error.message
        })
        .eq('id', documentId)
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})