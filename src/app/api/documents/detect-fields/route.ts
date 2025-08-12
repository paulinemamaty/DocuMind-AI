import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DocumentProcessingPipeline } from '@/services/document-processing-pipeline'
import { ErrorRecoveryService, ErrorType } from '@/services/error-recovery-service'
import APIValidator from '@/middleware/api-validator'

export async function POST(request: NextRequest) {
  // Validate request first
  const validation = await APIValidator.validateRequest(
    request,
    '/api/documents/detect-fields'
  )
  
  if (!validation.valid) {
    return validation.error!
  }

  const errorRecovery = ErrorRecoveryService.getInstance()
  const pipeline = DocumentProcessingPipeline.getInstance()

  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { documentId } = await request.json()

    // Use the processing pipeline with error recovery
    const result = await pipeline.processDocument(
      documentId,
      user.id,
      {
        detectFields: true,
        runOCR: false,
        validateFields: true,
        generateEmbeddings: false
      }
    )

    if (!result.success) {
      // Try error recovery
      const recovery = await errorRecovery.handleError(
        new Error(result.error || 'Processing failed'),
        {
          documentId,
          userId: user.id,
          operation: 'field-detection',
          metadata: { result }
        }
      )

      // If recovery suggests retry with backoff
      if (recovery.retryAfter) {
        return NextResponse.json(
          { 
            error: 'Processing temporarily unavailable',
            retryAfter: recovery.retryAfter,
            message: recovery.message
          },
          { 
            status: 503,
            headers: { 'Retry-After': String(recovery.retryAfter / 1000) }
          }
        )
      }

      // If recovery failed
      if (!recovery.success) {
        return NextResponse.json(
          { 
            error: recovery.message,
            details: result.error
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      fields: result.data?.fieldsDetected || 0,
      strategy: result.data?.strategy,
      documentId
    })

  } catch (error: any) {
    console.error('API error:', error)
    
    // Try error recovery
    const recovery = await errorRecovery.handleError(
      error,
      {
        operation: 'field-detection-api',
        metadata: { 
          url: request.url,
          method: request.method
        }
      }
    )

    return NextResponse.json(
      { 
        error: recovery.message || 'Internal server error',
        recovery: recovery.strategy
      },
      { status: 500 }
    )
  }
}