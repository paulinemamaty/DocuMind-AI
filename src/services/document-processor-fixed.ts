import { createServiceRoleClient } from '@/lib/supabase/server'
import { 
  processDocument,
  processDocumentWithMultipleProcessors,
  ExtractedFormField,
  DocumentProcessingResult
} from '@/lib/google/document-ai-client'
import { ProcessorType } from '@/lib/google/document-ai-config'
import { executeWithPooledClient } from '@/lib/google/connection-pool'
import { EmbeddingService } from './embedding-service'

export interface ProcessDocumentInput {
  documentId: string
  fileUrl: string
  mimeType: string
  userId: string
}

export interface FormFieldCoordinates {
  x: number
  y: number
  width: number
  height: number
}

function convertBoundingPolyToCoordinates(boundingPoly?: { vertices: Array<{ x: number; y: number }> }): FormFieldCoordinates | null {
  if (!boundingPoly || !boundingPoly.vertices || boundingPoly.vertices.length < 4) {
    return null
  }

  const vertices = boundingPoly.vertices
  const minX = Math.min(...vertices.map(v => v.x))
  const minY = Math.min(...vertices.map(v => v.y))
  const maxX = Math.max(...vertices.map(v => v.x))
  const maxY = Math.max(...vertices.map(v => v.y))

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

function inferFieldType(fieldName: string, fieldValue: string): string {
  const nameLower = fieldName.toLowerCase()
  const valueLower = fieldValue.toLowerCase()

  // Check for signature fields
  if (nameLower.includes('signature') || nameLower.includes('sign')) {
    return 'signature'
  }

  // Check for date fields
  if (nameLower.includes('date') || nameLower.includes('dob') || nameLower.includes('birth')) {
    return 'date'
  }

  // Check for checkbox fields
  if (valueLower === 'yes' || valueLower === 'no' || 
      valueLower === 'true' || valueLower === 'false' ||
      valueLower === '☐' || valueLower === '☑' || valueLower === '☒') {
    return 'checkbox'
  }

  // Check for dropdown fields
  if (nameLower.includes('select') || nameLower.includes('choose') || nameLower.includes('option')) {
    return 'dropdown'
  }

  // Default to text field
  return 'text'
}

export async function processDocumentWithAI(input: ProcessDocumentInput): Promise<void> {
  const supabase = await createServiceRoleClient()
  const startTime = Date.now()
  
  console.log(`Starting document processing for ${input.documentId}`)

  try {
    // Update document status to processing
    const { error: updateError } = await supabase
      .from('documents')
      .update({ 
        status: 'processing'
      })
      .eq('id', input.documentId)

    if (updateError) {
      console.error('Failed to update document status:', updateError)
    }

    // Download the document from Supabase storage
    console.log('Downloading document from storage...')
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(input.fileUrl)

    if (downloadError || !fileData) {
      throw new Error(`Failed to download document: ${downloadError?.message}`)
    }

    // Convert blob to buffer
    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    console.log(`Document downloaded, size: ${buffer.length} bytes`)

    // Process document with multiple Document AI processors
    console.log('Processing with Google Document AI...')
    const result: DocumentProcessingResult = await processDocumentWithMultipleProcessors(
      input.mimeType,
      buffer
    )

    const processingTime = Date.now() - startTime
    console.log(`Document AI processing completed in ${processingTime}ms`)
    console.log(`Extracted text length: ${result.text?.length || 0}`)
    console.log(`Form fields detected: ${result.formFields?.length || 0}`)
    console.log(`Tables detected: ${result.tables?.length || 0}`)

    // First, delete any existing extraction data (to avoid duplicate key errors)
    await supabase
      .from('document_extractions')
      .delete()
      .eq('document_id', input.documentId)

    // Store extraction results
    if (result.text && result.text.length > 0) {
      console.log('Storing extraction results...')
      
      const extractionData = {
        document_id: input.documentId,
        full_text: result.text,
        entities: result.entities ? result.entities : [],
        tables: result.tables ? result.tables : [],
        summary: result.summary || null,
        processing_time_ms: processingTime
      }

      const { error: extractionError } = await supabase
        .from('document_extractions')
        .insert(extractionData)

      if (extractionError) {
        console.error('Failed to store extraction results:', extractionError)
        // Don't throw - continue with rest of processing
      } else {
        console.log('Extraction results stored successfully')
      }
    }

    // Delete existing form fields before inserting new ones
    await supabase
      .from('document_form_fields')
      .delete()
      .eq('document_id', input.documentId)

    // Store form fields if detected
    if (result.formFields && result.formFields.length > 0) {
      console.log(`Storing ${result.formFields.length} form fields...`)
      
      const formFieldsToInsert = result.formFields.map((field: ExtractedFormField, index: number) => {
        const coordinates = convertBoundingPolyToCoordinates(field.boundingPoly)
        const fieldType = inferFieldType(field.fieldName, field.fieldValue)

        return {
          document_id: input.documentId,
          field_type: fieldType,
          field_name: field.fieldName || `field_${index}`,
          field_label: field.fieldName || `Field ${index + 1}`,
          field_value: field.fieldValue || '',
          confidence: field.confidence || 0,
          coordinates: coordinates || { x: 0, y: 0, width: 100, height: 20 },
          page_number: field.pageNumber || 1,
        }
      })

      const { error: formFieldsError } = await supabase
        .from('document_form_fields')
        .insert(formFieldsToInsert)

      if (formFieldsError) {
        console.error('Failed to store form fields:', formFieldsError)
        // Don't throw - continue with rest of processing
      } else {
        console.log('Form fields stored successfully')
      }
    }

    // Delete existing chunks before generating new embeddings
    await supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', input.documentId)

    // Generate embeddings for RAG
    if (result.text && result.text.length > 0) {
      try {
        console.log('Generating embeddings...')
        const embeddingService = new EmbeddingService()
        await embeddingService.processDocumentEmbeddings({
          documentId: input.documentId,
          text: result.text,
          metadata: {
            filename: input.fileUrl,
            mimeType: input.mimeType,
          },
        })
        console.log('Embeddings generated successfully')
      } catch (embeddingError) {
        console.error('Failed to generate embeddings:', embeddingError)
        // Don't fail the whole process if embeddings fail
      }
    }

    // Update document status to completed
    const { error: finalUpdateError } = await supabase
      .from('documents')
      .update({ 
        status: 'completed',
        metadata: {
          processingTime,
          textLength: result.text?.length || 0,
          formFieldCount: result.formFields?.length || 0,
          tableCount: result.tables?.length || 0,
          pageCount: result.pages?.length || 0,
          embeddingsGenerated: true,
          processedAt: new Date().toISOString()
        }
      })
      .eq('id', input.documentId)

    if (finalUpdateError) {
      console.error('Failed to update document status to completed:', finalUpdateError)
    }

    console.log(`✅ Document ${input.documentId} processed successfully`)

  } catch (error) {
    console.error('Document processing error:', error)
    
    // Update document status to failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    await supabase
      .from('documents')
      .update({ 
        status: 'failed',
        metadata: {
          error: errorMessage,
          failedAt: new Date().toISOString()
        }
      })
      .eq('id', input.documentId)

    throw error
  }
}

export async function reprocessDocument(documentId: string): Promise<void> {
  const supabase = await createServiceRoleClient()

  // Get document details
  const { data: document, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single()

  if (error || !document) {
    throw new Error('Document not found')
  }

  console.log(`Reprocessing document ${documentId}...`)

  // Delete existing data
  await Promise.all([
    supabase.from('document_extractions').delete().eq('document_id', documentId),
    supabase.from('document_form_fields').delete().eq('document_id', documentId),
    supabase.from('document_chunks').delete().eq('document_id', documentId)
  ])

  // Reprocess the document
  await processDocumentWithAI({
    documentId: document.id,
    fileUrl: document.file_url,
    mimeType: document.mime_type,
    userId: document.user_id,
  })
}