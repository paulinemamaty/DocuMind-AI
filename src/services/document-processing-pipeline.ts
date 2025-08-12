import { createClient } from '@/lib/supabase/client'
import { FieldDetectionService, DetectedField } from './field-detection-service'
import { v4 as uuidv4 } from 'uuid'

export enum ProcessingStage {
  UPLOAD = 'upload',
  FIELD_DETECTION = 'field_detection',
  OCR = 'ocr',
  VALIDATION = 'validation',
  STORAGE = 'storage',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface ProcessingResult {
  success: boolean
  stage: ProcessingStage
  message: string
  data?: any
  error?: string
}

export interface ProcessingOptions {
  detectFields?: boolean
  runOCR?: boolean
  validateFields?: boolean
  generateEmbeddings?: boolean
  webhookUrl?: string
}

/**
 * Local document processing pipeline that doesn't rely on edge functions
 */
export class DocumentProcessingPipeline {
  private static instance: DocumentProcessingPipeline
  private fieldDetectionService: FieldDetectionService
  private processingQueue: Map<string, ProcessingStage> = new Map()
  
  private constructor() {
    this.fieldDetectionService = FieldDetectionService.getInstance()
  }
  
  static getInstance(): DocumentProcessingPipeline {
    if (!this.instance) {
      this.instance = new DocumentProcessingPipeline()
    }
    return this.instance
  }

  /**
   * Process a document through the entire pipeline
   */
  async processDocument(
    documentId: string,
    userId: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const supabase = createClient()
    
    // Check if already processing
    if (this.processingQueue.has(documentId)) {
      return {
        success: false,
        stage: this.processingQueue.get(documentId)!,
        message: 'Document is already being processed',
        error: 'ALREADY_PROCESSING'
      }
    }

    try {
      // Mark as processing
      this.processingQueue.set(documentId, ProcessingStage.UPLOAD)
      
      // Update document status
      await this.updateDocumentStatus(documentId, 'processing')

      // Stage 1: Fetch document
      console.log(`📄 [${documentId}] Stage 1: Fetching document`)
      const { data: document, error: fetchError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .eq('user_id', userId)
        .single()

      if (fetchError || !document) {
        throw new Error(`Document not found: ${fetchError?.message}`)
      }

      // Stage 2: Download file from storage
      console.log(`📦 [${documentId}] Stage 2: Downloading file`)
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(document.file_url)

      if (downloadError || !fileData) {
        throw new Error(`Failed to download file: ${downloadError?.message}`)
      }

      const arrayBuffer = await fileData.arrayBuffer()

      // Stage 3: Field Detection (if enabled)
      let detectedFields: DetectedField[] = []
      if (options.detectFields !== false) {
        this.processingQueue.set(documentId, ProcessingStage.FIELD_DETECTION)
        console.log(`🔍 [${documentId}] Stage 3: Detecting fields`)
        
        const detectionResult = await this.fieldDetectionService.detectFields(
          documentId,
          arrayBuffer,
          document.mime_type || 'application/pdf'
        )

        detectedFields = detectionResult.fields
        
        // Save detected fields
        if (detectedFields.length > 0) {
          await this.saveDetectedFields(documentId, detectedFields)
          console.log(`✅ [${documentId}] Saved ${detectedFields.length} fields`)
        }

        // Update metadata with detection info
        await supabase
          .from('documents')
          .update({
            metadata: {
              ...document.metadata,
              fieldDetection: {
                strategy: detectionResult.strategy,
                fieldsDetected: detectedFields.length,
                detectedAt: new Date().toISOString()
              }
            }
          })
          .eq('id', documentId)
      }

      // Stage 4: OCR (if needed and enabled)
      if (options.runOCR && document.mime_type?.includes('image')) {
        this.processingQueue.set(documentId, ProcessingStage.OCR)
        console.log(`📝 [${documentId}] Stage 4: Running OCR`)
        // OCR implementation would go here
        // For now, we'll skip this stage
      }

      // Stage 5: Field Validation
      if (options.validateFields && detectedFields.length > 0) {
        this.processingQueue.set(documentId, ProcessingStage.VALIDATION)
        console.log(`✔️ [${documentId}] Stage 5: Validating fields`)
        
        const validationResults = await this.validateFields(detectedFields)
        
        // Update fields with validation results
        for (const field of detectedFields) {
          const validation = validationResults.get(field.id)
          if (validation) {
            await supabase
              .from('document_form_fields')
              .update({
                metadata: {
                  ...field.metadata,
                  validation
                }
              })
              .eq('id', field.id)
          }
        }
      }

      // Stage 6: Complete processing
      this.processingQueue.set(documentId, ProcessingStage.COMPLETED)
      await this.updateDocumentStatus(documentId, 'completed')

      // Send webhook notification if configured
      if (options.webhookUrl) {
        this.sendWebhook(options.webhookUrl, {
          event: 'document.processed',
          documentId,
          fieldsDetected: detectedFields.length,
          timestamp: new Date().toISOString()
        }).catch(err => console.error('Webhook failed:', err))
      }

      // Clean up from queue
      this.processingQueue.delete(documentId)

      return {
        success: true,
        stage: ProcessingStage.COMPLETED,
        message: `Document processed successfully. ${detectedFields.length} fields detected.`,
        data: {
          documentId,
          fieldsDetected: detectedFields.length,
          fields: detectedFields
        }
      }

    } catch (error: any) {
      console.error(`❌ [${documentId}] Processing failed:`, error)
      
      // Update status to failed
      await this.updateDocumentStatus(documentId, 'failed', error.message)
      
      // Clean up from queue
      this.processingQueue.delete(documentId)

      return {
        success: false,
        stage: ProcessingStage.FAILED,
        message: 'Document processing failed',
        error: error.message
      }
    }
  }

  /**
   * Save detected fields to database
   */
  private async saveDetectedFields(
    documentId: string,
    fields: DetectedField[]
  ): Promise<void> {
    const supabase = createClient()
    
    // Delete existing fields for this document first
    await supabase
      .from('document_form_fields')
      .delete()
      .eq('document_id', documentId)

    // Insert new fields in batches of 50
    const batchSize = 50
    for (let i = 0; i < fields.length; i += batchSize) {
      const batch = fields.slice(i, i + batchSize)
      
      const { error } = await supabase
        .from('document_form_fields')
        .insert(batch)

      if (error) {
        console.error(`Failed to insert fields batch ${i / batchSize + 1}:`, error)
        throw error
      }
    }
  }

  /**
   * Validate detected fields
   */
  private async validateFields(
    fields: DetectedField[]
  ): Promise<Map<string, any>> {
    const validationResults = new Map<string, any>()

    for (const field of fields) {
      const validation = {
        isValid: true,
        errors: [] as string[],
        warnings: [] as string[]
      }

      // Check confidence
      if (field.confidence < 0.5) {
        validation.warnings.push('Low confidence detection')
      }

      // Validate by type
      switch (field.field_type) {
        case 'email':
          if (field.field_value && !this.isValidEmail(field.field_value)) {
            validation.errors.push('Invalid email format')
            validation.isValid = false
          }
          break
        
        case 'phone':
          if (field.field_value && !this.isValidPhone(field.field_value)) {
            validation.warnings.push('Phone number may be invalid')
          }
          break
        
        case 'ssn':
          if (field.field_value && !this.isValidSSN(field.field_value)) {
            validation.errors.push('Invalid SSN format')
            validation.isValid = false
          }
          break
        
        case 'zip':
          if (field.field_value && !this.isValidZIP(field.field_value)) {
            validation.warnings.push('ZIP code may be invalid')
          }
          break
      }

      // Check for missing coordinates
      if (!field.coordinates) {
        validation.warnings.push('No position coordinates')
      }

      validationResults.set(field.id, validation)
    }

    return validationResults
  }

  /**
   * Update document status in database
   */
  private async updateDocumentStatus(
    documentId: string,
    status: string,
    error?: string
  ): Promise<void> {
    const supabase = createClient()
    
    const update: any = {
      status,
      updated_at: new Date().toISOString()
    }

    if (error) {
      update.processing_error = error
      update.processing_attempts = (await this.getProcessingAttempts(documentId)) + 1
    }

    await supabase
      .from('documents')
      .update(update)
      .eq('id', documentId)
  }

  /**
   * Get current processing attempts
   */
  private async getProcessingAttempts(documentId: string): Promise<number> {
    const supabase = createClient()
    
    const { data } = await supabase
      .from('documents')
      .select('processing_attempts')
      .eq('id', documentId)
      .single()

    return data?.processing_attempts || 0
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(url: string, data: any): Promise<void> {
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
    } catch (error) {
      console.error('Webhook send failed:', error)
    }
  }

  /**
   * Validation helpers
   */
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  private isValidPhone(phone: string): boolean {
    return /^\+?[\d\s\-\(\)]+$/.test(phone) && phone.replace(/\D/g, '').length >= 10
  }

  private isValidSSN(ssn: string): boolean {
    return /^\d{3}-?\d{2}-?\d{4}$/.test(ssn)
  }

  private isValidZIP(zip: string): boolean {
    return /^\d{5}(-\d{4})?$/.test(zip)
  }

  /**
   * Get processing status for a document
   */
  getProcessingStatus(documentId: string): ProcessingStage | null {
    return this.processingQueue.get(documentId) || null
  }

  /**
   * Cancel processing for a document
   */
  cancelProcessing(documentId: string): boolean {
    if (this.processingQueue.has(documentId)) {
      this.processingQueue.delete(documentId)
      this.updateDocumentStatus(documentId, 'cancelled')
      return true
    }
    return false
  }
}