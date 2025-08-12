import { DocumentProcessorServiceClient } from '@google-cloud/documentai'
import { documentAIConfig, getProcessorPath, ProcessorType } from './document-ai-config'

// Create a singleton client instance
let clientInstance: DocumentProcessorServiceClient | null = null

export function getDocumentAIClient(): DocumentProcessorServiceClient {
  if (!clientInstance) {
    // Use credentials object if available, otherwise fall back to keyFilename
    const authOptions: any = documentAIConfig.credentials 
      ? { credentials: documentAIConfig.credentials }
      : documentAIConfig.keyFilename 
        ? { keyFilename: documentAIConfig.keyFilename }
        : {}
    
    clientInstance = new DocumentProcessorServiceClient(authOptions)
  }
  return clientInstance
}

export interface ProcessDocumentOptions {
  processorType: ProcessorType
  mimeType: string
  rawDocument: Buffer
}

export interface ExtractedEntity {
  type: string
  mentionText: string
  confidence: number
  pageAnchor?: {
    pageRefs: Array<{
      page: string
      boundingPoly?: {
        vertices: Array<{ x: number; y: number }>
      }
    }>
  }
}

export interface ExtractedFormField {
  fieldName: string
  fieldValue: string
  confidence: number
  boundingPoly?: {
    vertices: Array<{ x: number; y: number }>
  }
  pageNumber?: number
}

export interface ExtractedTable {
  headerRows: string[][]
  bodyRows: string[][]
  pageNumber?: number
}

export interface DocumentProcessingResult {
  text: string
  entities?: ExtractedEntity[]
  formFields?: ExtractedFormField[]
  tables?: ExtractedTable[]
  pages?: Array<{
    pageNumber: number
    width: number
    height: number
    blocks?: Array<{
      text: string
      boundingBox: {
        vertices: Array<{ x: number; y: number }>
      }
    }>
  }>
  summary?: string
}

export async function processDocument(
  options: ProcessDocumentOptions
): Promise<DocumentProcessingResult> {
  const client = getDocumentAIClient()
  
  const processorId = documentAIConfig.processors[options.processorType]
  const name = getProcessorPath(processorId)

  const request = {
    name,
    rawDocument: {
      content: options.rawDocument.toString('base64'),
      mimeType: options.mimeType,
    },
  }

  try {
    const [result] = await client.processDocument(request)
    const { document } = result

    if (!document) {
      throw new Error('No document returned from Document AI')
    }

    const response: DocumentProcessingResult = {
      text: document.text || '',
    }

    // Extract entities if available
    if (document.entities && document.entities.length > 0) {
      response.entities = document.entities.map((entity) => ({
        type: entity.type || 'unknown',
        mentionText: entity.mentionText || '',
        confidence: entity.confidence || 0,
        pageAnchor: entity.pageAnchor ? {
          pageRefs: entity.pageAnchor.pageRefs?.map(ref => ({
            page: String(ref.page || '0'),
            boundingPoly: ref.boundingPoly ? {
              vertices: ref.boundingPoly.vertices?.map(v => ({
                x: v.x || 0,
                y: v.y || 0
              })) || []
            } : undefined
          })) || []
        } : undefined
      }))
    }

    // Extract form fields for form parser
    if (options.processorType === ProcessorType.FORM_PARSER && document.pages) {
      const formFields: ExtractedFormField[] = []
      
      document.pages.forEach((page, pageIndex) => {
        if (page.formFields) {
          page.formFields.forEach((field) => {
            const fieldName = field.fieldName?.textAnchor?.content || ''
            const fieldValue = field.fieldValue?.textAnchor?.content || ''
            
            formFields.push({
              fieldName: fieldName.trim(),
              fieldValue: fieldValue.trim(),
              confidence: field.fieldName?.confidence || 0,
              boundingPoly: field.fieldName?.boundingPoly ? {
                vertices: field.fieldName.boundingPoly.vertices?.map(v => ({
                  x: v.x || 0,
                  y: v.y || 0
                })) || []
              } : undefined,
              pageNumber: pageIndex + 1,
            })
          })
        }
      })
      
      if (formFields.length > 0) {
        response.formFields = formFields
      }
    }

    // Extract tables if available
    if (document.pages) {
      const tables: ExtractedTable[] = []
      
      document.pages.forEach((page, pageIndex) => {
        if (page.tables) {
          page.tables.forEach((table) => {
            const headerRows: string[][] = []
            const bodyRows: string[][] = []
            
            if (table.headerRows) {
              table.headerRows.forEach((row) => {
                const cells = row.cells?.map((cell) => 
                  cell.layout?.textAnchor?.content || ''
                ) || []
                headerRows.push(cells)
              })
            }
            
            if (table.bodyRows) {
              table.bodyRows.forEach((row) => {
                const cells = row.cells?.map((cell) => 
                  cell.layout?.textAnchor?.content || ''
                ) || []
                bodyRows.push(cells)
              })
            }
            
            if (headerRows.length > 0 || bodyRows.length > 0) {
              tables.push({
                headerRows,
                bodyRows,
                pageNumber: pageIndex + 1,
              })
            }
          })
        }
      })
      
      if (tables.length > 0) {
        response.tables = tables
      }
    }

    // Extract layout blocks for layout parser
    if (options.processorType === ProcessorType.LAYOUT_PARSER && document.pages) {
      response.pages = document.pages.map((page, index) => {
        const blocks = page.blocks?.map((block) => ({
          text: block.layout?.textAnchor?.content || '',
          boundingBox: {
            vertices: block.layout?.boundingPoly?.vertices?.map(v => ({
              x: v.x || 0,
              y: v.y || 0
            })) || [],
          },
        })) || []

        return {
          pageNumber: index + 1,
          width: page.dimension?.width || 0,
          height: page.dimension?.height || 0,
          blocks,
        }
      })
    }

    // Extract summary for summarizer
    if (options.processorType === ProcessorType.SUMMARIZER) {
      // The summarizer returns the summary in the text field
      response.summary = document.text || ''
    }

    return response
  } catch (error) {
    console.error('Error processing document with Document AI:', error)
    throw new Error(`Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function processDocumentWithMultipleProcessors(
  mimeType: string,
  rawDocument: Buffer
): Promise<DocumentProcessingResult> {
  const results: DocumentProcessingResult[] = await Promise.all([
    processDocument({
      processorType: ProcessorType.OCR,
      mimeType,
      rawDocument,
    }),
    processDocument({
      processorType: ProcessorType.FORM_PARSER,
      mimeType,
      rawDocument,
    }),
    processDocument({
      processorType: ProcessorType.LAYOUT_PARSER,
      mimeType,
      rawDocument,
    }),
  ])

  // Merge results from different processors
  const mergedResult: DocumentProcessingResult = {
    text: results[0].text, // OCR text
    formFields: results[1].formFields,
    pages: results[2].pages,
    entities: results[0].entities || results[1].entities,
    tables: results[1].tables,
  }

  return mergedResult
}