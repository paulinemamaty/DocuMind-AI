import { createClient } from '@/lib/supabase/client'
import { DocumentProcessorServiceClient } from '@google-cloud/documentai'
import * as pdfjsLib from 'pdfjs-dist'
import { v4 as uuidv4 } from 'uuid'

// Field detection strategies in order of preference
export enum DetectionStrategy {
  DOCUMENT_AI = 'document_ai',
  PDF_FORM_FIELDS = 'pdf_form_fields', 
  TEXT_PATTERN = 'text_pattern',
  MOCK_DATA = 'mock_data'
}

export interface DetectedField {
  id: string
  document_id: string
  field_name: string
  field_label: string
  field_type: string
  field_value: string
  confidence: number
  coordinates?: {
    page: number
    x: number
    y: number
    width: number
    height: number
  }
  page_number: number
  metadata?: Record<string, any>
}

export class FieldDetectionService {
  private static instance: FieldDetectionService
  private documentAIClient: DocumentProcessorServiceClient | null = null
  
  private constructor() {}
  
  static getInstance(): FieldDetectionService {
    if (!this.instance) {
      this.instance = new FieldDetectionService()
    }
    return this.instance
  }

  /**
   * Main detection method with multiple fallback strategies
   */
  async detectFields(
    documentId: string,
    fileData: ArrayBuffer,
    mimeType: string
  ): Promise<{
    fields: DetectedField[]
    strategy: DetectionStrategy
    error?: string
  }> {
    console.log('🔍 Starting field detection for document:', documentId)
    
    // Try strategies in order
    const strategies = [
      this.detectWithDocumentAI.bind(this),
      this.detectFromPDFFormFields.bind(this),
      this.detectWithTextPatterns.bind(this),
      this.generateMockFields.bind(this)
    ]
    
    for (const [index, strategy] of strategies.entries()) {
      try {
        const strategyName = Object.values(DetectionStrategy)[index]
        console.log(`📋 Trying strategy: ${strategyName}`)
        
        const result = await strategy(documentId, fileData, mimeType)
        
        if (result.fields.length > 0) {
          console.log(`✅ Successfully detected ${result.fields.length} fields using ${strategyName}`)
          return result
        }
      } catch (error) {
        console.warn(`Strategy failed:`, error)
        continue
      }
    }
    
    // If all strategies fail, return empty with error
    return {
      fields: [],
      strategy: DetectionStrategy.MOCK_DATA,
      error: 'All detection strategies failed'
    }
  }

  /**
   * Strategy 1: Use Google Document AI
   */
  private async detectWithDocumentAI(
    documentId: string,
    fileData: ArrayBuffer,
    mimeType: string
  ): Promise<{ fields: DetectedField[], strategy: DetectionStrategy }> {
    // Check if Document AI is configured
    if (!process.env.GCP_CREDENTIALS_BASE64 || !process.env.GCP_FORM_PARSER_PROCESSOR_ID) {
      throw new Error('Document AI not configured')
    }

    if (!this.documentAIClient) {
      const credentials = JSON.parse(
        Buffer.from(process.env.GCP_CREDENTIALS_BASE64, 'base64').toString()
      )
      
      this.documentAIClient = new DocumentProcessorServiceClient({
        credentials,
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      })
    }

    const base64Content = Buffer.from(fileData).toString('base64')
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID!
    const location = process.env.GCP_LOCATION || 'us'
    const processorId = process.env.GCP_FORM_PARSER_PROCESSOR_ID!
    
    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`

    const [result] = await this.documentAIClient.processDocument({
      name,
      rawDocument: {
        content: base64Content,
        mimeType,
      },
    })

    const fields: DetectedField[] = []

    if (result.document?.pages) {
      for (const page of result.document.pages) {
        const pageNumber = (page.pageNumber || 0) + 1

        if (page.formFields) {
          for (const formField of page.formFields) {
            const fieldName = formField.fieldName?.textAnchor?.content || ''
            const fieldValue = formField.fieldValue?.textAnchor?.content || ''
            
            // Extract coordinates
            let coordinates = undefined
            if (formField.fieldName?.layout?.boundingPoly?.normalizedVertices) {
              const vertices = formField.fieldName.layout.boundingPoly.normalizedVertices
              if (vertices.length >= 4) {
                coordinates = {
                  page: pageNumber,
                  x: (vertices[0].x || 0) * 100, // Convert to percentage
                  y: (vertices[0].y || 0) * 100,
                  width: ((vertices[1].x || 0) - (vertices[0].x || 0)) * 100,
                  height: ((vertices[2].y || 0) - (vertices[0].y || 0)) * 100
                }
              }
            }

            fields.push({
              id: uuidv4(),
              document_id: documentId,
              field_name: this.sanitizeFieldName(fieldName),
              field_label: fieldName,
              field_type: this.detectFieldType(fieldName, fieldValue),
              field_value: fieldValue,
              confidence: formField.fieldName?.confidence || 0,
              coordinates,
              page_number: pageNumber,
              metadata: {
                valueConfidence: formField.fieldValue?.confidence || 0
              }
            })
          }
        }
      }
    }

    return { fields, strategy: DetectionStrategy.DOCUMENT_AI }
  }

  /**
   * Strategy 2: Extract from PDF form fields (AcroForm)
   */
  private async detectFromPDFFormFields(
    documentId: string,
    fileData: ArrayBuffer,
    mimeType: string
  ): Promise<{ fields: DetectedField[], strategy: DetectionStrategy }> {
    if (!mimeType.includes('pdf')) {
      throw new Error('Not a PDF document')
    }

    // Initialize PDF.js
    const pdfjsLib = (await import('pdfjs-dist')).default
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

    const loadingTask = pdfjsLib.getDocument({ data: fileData })
    const pdf = await loadingTask.promise
    const fields: DetectedField[] = []

    // Check for AcroForm
    const acroForm = await pdf.getFieldObjects()
    
    if (acroForm && Object.keys(acroForm).length > 0) {
      for (const [fieldName, fieldInfo] of Object.entries(acroForm)) {
        const field = fieldInfo[0] as any
        
        // Get page number for this field
        let pageNumber = 1
        let coordinates = undefined
        
        // Try to get field position
        if (field.rect) {
          coordinates = {
            page: pageNumber,
            x: field.rect[0],
            y: field.rect[1],
            width: field.rect[2] - field.rect[0],
            height: field.rect[3] - field.rect[1]
          }
        }

        fields.push({
          id: uuidv4(),
          document_id: documentId,
          field_name: this.sanitizeFieldName(fieldName),
          field_label: field.alternativeText || fieldName,
          field_type: this.mapPDFFieldType(field.type),
          field_value: field.value || field.defaultValue || '',
          confidence: 1.0, // PDF form fields are definitive
          coordinates,
          page_number: pageNumber,
          metadata: {
            pdfFieldType: field.type,
            required: field.required || false,
            readOnly: field.readOnly || false,
            multiline: field.multiline || false
          }
        })
      }
    }

    // Also try to extract from annotations
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const annotations = await page.getAnnotations()
      
      for (const annotation of annotations) {
        if (annotation.subtype === 'Widget' && annotation.fieldName) {
          // Check if we already have this field
          if (!fields.find(f => f.field_name === this.sanitizeFieldName(annotation.fieldName))) {
            const rect = annotation.rect
            
            fields.push({
              id: uuidv4(),
              document_id: documentId,
              field_name: this.sanitizeFieldName(annotation.fieldName),
              field_label: annotation.alternativeText || annotation.fieldName,
              field_type: this.mapPDFFieldType(annotation.fieldType),
              field_value: annotation.fieldValue || '',
              confidence: 0.95,
              coordinates: rect ? {
                page: pageNum,
                x: rect[0],
                y: rect[1],
                width: rect[2] - rect[0],
                height: rect[3] - rect[1]
              } : undefined,
              page_number: pageNum,
              metadata: {
                annotationType: annotation.subtype
              }
            })
          }
        }
      }
    }

    return { fields, strategy: DetectionStrategy.PDF_FORM_FIELDS }
  }

  /**
   * Strategy 3: Detect fields using text patterns and heuristics
   */
  private async detectWithTextPatterns(
    documentId: string,
    fileData: ArrayBuffer,
    mimeType: string
  ): Promise<{ fields: DetectedField[], strategy: DetectionStrategy }> {
    if (!mimeType.includes('pdf')) {
      throw new Error('Text pattern detection only works with PDFs')
    }

    const pdfjsLib = (await import('pdfjs-dist')).default
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

    const loadingTask = pdfjsLib.getDocument({ data: fileData })
    const pdf = await loadingTask.promise
    const fields: DetectedField[] = []

    // Common field patterns
    const fieldPatterns = [
      { pattern: /(?:name|full\s*name)\s*:?\s*_{3,}|\[_+\]/gi, type: 'text', label: 'Name' },
      { pattern: /(?:email|e-mail)\s*(?:address)?\s*:?\s*_{3,}|\[_+\]/gi, type: 'email', label: 'Email' },
      { pattern: /(?:phone|tel|telephone)\s*(?:number)?\s*:?\s*_{3,}|\[_+\]/gi, type: 'phone', label: 'Phone' },
      { pattern: /(?:date|dob|birth\s*date)\s*:?\s*_{3,}|\[_+\]/gi, type: 'date', label: 'Date' },
      { pattern: /(?:address|street)\s*:?\s*_{3,}|\[_+\]/gi, type: 'address', label: 'Address' },
      { pattern: /(?:city)\s*:?\s*_{3,}|\[_+\]/gi, type: 'text', label: 'City' },
      { pattern: /(?:state)\s*:?\s*_{3,}|\[_+\]/gi, type: 'text', label: 'State' },
      { pattern: /(?:zip|postal)\s*(?:code)?\s*:?\s*_{3,}|\[_+\]/gi, type: 'zip', label: 'ZIP Code' },
      { pattern: /(?:ssn|social\s*security)\s*:?\s*_{3,}|\[_+\]/gi, type: 'ssn', label: 'SSN' },
      { pattern: /\[\s*\]/g, type: 'checkbox', label: 'Checkbox' },
      { pattern: /\(\s*\)/g, type: 'radio', label: 'Radio' },
      { pattern: /signature\s*:?\s*_{3,}/gi, type: 'signature', label: 'Signature' }
    ]

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map((item: any) => item.str).join(' ')
      
      // Search for patterns
      for (const { pattern, type, label } of fieldPatterns) {
        let match
        while ((match = pattern.exec(pageText)) !== null) {
          const fieldId = uuidv4()
          const fieldName = `${label.toLowerCase().replace(/\s+/g, '_')}_${fields.length + 1}`
          
          fields.push({
            id: fieldId,
            document_id: documentId,
            field_name: fieldName,
            field_label: label,
            field_type: type,
            field_value: '',
            confidence: 0.7, // Pattern matching is less certain
            coordinates: undefined, // Would need more complex logic to determine position
            page_number: pageNum,
            metadata: {
              detectionMethod: 'pattern',
              pattern: pattern.source
            }
          })
        }
      }
    }

    return { fields, strategy: DetectionStrategy.TEXT_PATTERN }
  }

  /**
   * Strategy 4: Generate mock fields for testing
   */
  private async generateMockFields(
    documentId: string,
    fileData: ArrayBuffer,
    mimeType: string
  ): Promise<{ fields: DetectedField[], strategy: DetectionStrategy }> {
    console.log('⚠️ Using mock field data for testing')
    
    const commonFields = [
      { name: 'full_name', label: 'Full Name', type: 'text', y: 150 },
      { name: 'email', label: 'Email Address', type: 'email', y: 200 },
      { name: 'phone', label: 'Phone Number', type: 'phone', y: 250 },
      { name: 'date_of_birth', label: 'Date of Birth', type: 'date', y: 300 },
      { name: 'address', label: 'Street Address', type: 'address', y: 350 },
      { name: 'city', label: 'City', type: 'text', y: 400 },
      { name: 'state', label: 'State', type: 'text', y: 450 },
      { name: 'zip_code', label: 'ZIP Code', type: 'zip', y: 500 },
      { name: 'signature', label: 'Signature', type: 'signature', y: 600 }
    ]

    const fields: DetectedField[] = commonFields.map((field, index) => ({
      id: uuidv4(),
      document_id: documentId,
      field_name: field.name,
      field_label: field.label,
      field_type: field.type,
      field_value: '',
      confidence: 0.85 + (Math.random() * 0.15), // 0.85-1.0
      coordinates: {
        page: 1,
        x: 100,
        y: field.y,
        width: 300,
        height: 40
      },
      page_number: 1,
      metadata: {
        isMockData: true
      }
    }))

    return { fields, strategy: DetectionStrategy.MOCK_DATA }
  }

  /**
   * Helper methods
   */
  private sanitizeFieldName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
  }

  private detectFieldType(fieldName: string, fieldValue: string = ''): string {
    const name = fieldName.toLowerCase()
    
    // Check by name patterns
    if (name.includes('email') || name.includes('e-mail')) return 'email'
    if (name.includes('phone') || name.includes('tel')) return 'phone'
    if (name.includes('date') || name.includes('dob')) return 'date'
    if (name.includes('ssn') || name.includes('social')) return 'ssn'
    if (name.includes('zip') || name.includes('postal')) return 'zip'
    if (name.includes('address') || name.includes('street')) return 'address'
    if (name.includes('signature') || name.includes('sign')) return 'signature'
    if (name.includes('city')) return 'text'
    if (name.includes('state')) return 'text'
    if (name.includes('country')) return 'text'
    
    // Check by value patterns
    if (fieldValue) {
      if (/^\d{3}-\d{3}-\d{4}$/.test(fieldValue)) return 'phone'
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fieldValue)) return 'email'
      if (/^\d{5}(-\d{4})?$/.test(fieldValue)) return 'zip'
      if (/^\d{3}-\d{2}-\d{4}$/.test(fieldValue)) return 'ssn'
    }
    
    return 'text'
  }

  private mapPDFFieldType(pdfType: string): string {
    const typeMap: Record<string, string> = {
      'Tx': 'text',
      'Ch': 'select',
      'Btn': 'checkbox',
      'Sig': 'signature'
    }
    return typeMap[pdfType] || 'text'
  }
}

export default FieldDetectionService