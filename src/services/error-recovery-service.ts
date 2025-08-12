import { createClient } from '@/lib/supabase/client'

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export enum RecoveryStrategy {
  RETRY = 'RETRY',
  RETRY_WITH_BACKOFF = 'RETRY_WITH_BACKOFF',
  FALLBACK = 'FALLBACK',
  QUEUE_FOR_LATER = 'QUEUE_FOR_LATER',
  NOTIFY_USER = 'NOTIFY_USER',
  LOG_AND_CONTINUE = 'LOG_AND_CONTINUE',
  FAIL_FAST = 'FAIL_FAST'
}

export interface ErrorContext {
  documentId?: string
  userId?: string
  operation: string
  stage?: string
  metadata?: Record<string, any>
}

export interface RecoveryResult {
  success: boolean
  strategy: RecoveryStrategy
  message: string
  data?: any
  retryAfter?: number
}

/**
 * Comprehensive error handling and recovery service
 */
export class ErrorRecoveryService {
  private static instance: ErrorRecoveryService
  private retryAttempts: Map<string, number> = new Map()
  private errorLog: Array<{
    timestamp: Date
    error: Error
    context: ErrorContext
    recovery: RecoveryResult
  }> = []
  
  private readonly MAX_RETRIES = 3
  private readonly BASE_BACKOFF_MS = 1000
  
  private constructor() {}
  
  static getInstance(): ErrorRecoveryService {
    if (!this.instance) {
      this.instance = new ErrorRecoveryService()
    }
    return this.instance
  }

  /**
   * Handle an error with automatic recovery strategies
   */
  async handleError(
    error: Error,
    context: ErrorContext
  ): Promise<RecoveryResult> {
    console.error(`🚨 Error in ${context.operation}:`, error.message)
    
    const errorType = this.classifyError(error)
    const strategy = this.determineRecoveryStrategy(errorType, context)
    
    let result: RecoveryResult
    
    switch (strategy) {
      case RecoveryStrategy.RETRY:
        result = await this.retryOperation(error, context)
        break
      
      case RecoveryStrategy.RETRY_WITH_BACKOFF:
        result = await this.retryWithBackoff(error, context)
        break
      
      case RecoveryStrategy.FALLBACK:
        result = await this.executeFallback(error, context)
        break
      
      case RecoveryStrategy.QUEUE_FOR_LATER:
        result = await this.queueForLater(error, context)
        break
      
      case RecoveryStrategy.NOTIFY_USER:
        result = await this.notifyUser(error, context)
        break
      
      case RecoveryStrategy.LOG_AND_CONTINUE:
        result = await this.logAndContinue(error, context)
        break
      
      case RecoveryStrategy.FAIL_FAST:
      default:
        result = this.failFast(error, context)
        break
    }
    
    // Log the error and recovery attempt
    this.errorLog.push({
      timestamp: new Date(),
      error,
      context,
      recovery: result
    })
    
    // Store in database for persistence
    if (context.documentId) {
      await this.storeErrorInDatabase(error, context, result)
    }
    
    return result
  }

  /**
   * Classify the error type
   */
  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase()
    
    if (message.includes('network') || message.includes('fetch')) {
      return ErrorType.NETWORK_ERROR
    }
    
    if (message.includes('unauthorized') || message.includes('forbidden')) {
      return ErrorType.AUTH_ERROR
    }
    
    if (message.includes('storage') || message.includes('upload') || message.includes('download')) {
      return ErrorType.STORAGE_ERROR
    }
    
    if (message.includes('processing') || message.includes('document ai')) {
      return ErrorType.PROCESSING_ERROR
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorType.VALIDATION_ERROR
    }
    
    if (message.includes('quota') || message.includes('limit')) {
      return ErrorType.QUOTA_EXCEEDED
    }
    
    return ErrorType.UNKNOWN_ERROR
  }

  /**
   * Determine the best recovery strategy
   */
  private determineRecoveryStrategy(
    errorType: ErrorType,
    context: ErrorContext
  ): RecoveryStrategy {
    // Get retry count for this operation
    const retryKey = `${context.operation}-${context.documentId || 'global'}`
    const retryCount = this.retryAttempts.get(retryKey) || 0
    
    // If we've exceeded max retries, queue or fail
    if (retryCount >= this.MAX_RETRIES) {
      if (errorType === ErrorType.PROCESSING_ERROR) {
        return RecoveryStrategy.QUEUE_FOR_LATER
      }
      return RecoveryStrategy.FAIL_FAST
    }
    
    // Determine strategy based on error type
    switch (errorType) {
      case ErrorType.NETWORK_ERROR:
        return RecoveryStrategy.RETRY_WITH_BACKOFF
      
      case ErrorType.AUTH_ERROR:
        return RecoveryStrategy.NOTIFY_USER
      
      case ErrorType.STORAGE_ERROR:
        return retryCount === 0 
          ? RecoveryStrategy.RETRY 
          : RecoveryStrategy.FALLBACK
      
      case ErrorType.PROCESSING_ERROR:
        return RecoveryStrategy.FALLBACK
      
      case ErrorType.VALIDATION_ERROR:
        return RecoveryStrategy.LOG_AND_CONTINUE
      
      case ErrorType.QUOTA_EXCEEDED:
        return RecoveryStrategy.QUEUE_FOR_LATER
      
      default:
        return RecoveryStrategy.LOG_AND_CONTINUE
    }
  }

  /**
   * Retry the operation immediately
   */
  private async retryOperation(
    error: Error,
    context: ErrorContext
  ): Promise<RecoveryResult> {
    const retryKey = `${context.operation}-${context.documentId || 'global'}`
    const retryCount = (this.retryAttempts.get(retryKey) || 0) + 1
    this.retryAttempts.set(retryKey, retryCount)
    
    console.log(`🔄 Retrying ${context.operation} (attempt ${retryCount}/${this.MAX_RETRIES})`)
    
    return {
      success: false,
      strategy: RecoveryStrategy.RETRY,
      message: `Retrying operation (attempt ${retryCount})`,
      data: { retryCount }
    }
  }

  /**
   * Retry with exponential backoff
   */
  private async retryWithBackoff(
    error: Error,
    context: ErrorContext
  ): Promise<RecoveryResult> {
    const retryKey = `${context.operation}-${context.documentId || 'global'}`
    const retryCount = (this.retryAttempts.get(retryKey) || 0) + 1
    this.retryAttempts.set(retryKey, retryCount)
    
    const backoffMs = this.BASE_BACKOFF_MS * Math.pow(2, retryCount - 1)
    
    console.log(`⏳ Retrying ${context.operation} after ${backoffMs}ms (attempt ${retryCount}/${this.MAX_RETRIES})`)
    
    return {
      success: false,
      strategy: RecoveryStrategy.RETRY_WITH_BACKOFF,
      message: `Retrying operation after ${backoffMs}ms`,
      retryAfter: backoffMs,
      data: { retryCount, backoffMs }
    }
  }

  /**
   * Execute fallback strategy
   */
  private async executeFallback(
    error: Error,
    context: ErrorContext
  ): Promise<RecoveryResult> {
    console.log(`🔀 Executing fallback for ${context.operation}`)
    
    // Determine fallback based on operation
    let fallbackMessage = 'Using fallback strategy'
    let fallbackData: any = {}
    
    if (context.operation.includes('field-detection')) {
      fallbackMessage = 'Using mock field detection'
      fallbackData = { strategy: 'mock_fields' }
    } else if (context.operation.includes('storage')) {
      fallbackMessage = 'Using local storage fallback'
      fallbackData = { strategy: 'local_storage' }
    } else if (context.operation.includes('processing')) {
      fallbackMessage = 'Using simplified processing'
      fallbackData = { strategy: 'simplified_processing' }
    }
    
    return {
      success: true,
      strategy: RecoveryStrategy.FALLBACK,
      message: fallbackMessage,
      data: fallbackData
    }
  }

  /**
   * Queue operation for later retry
   */
  private async queueForLater(
    error: Error,
    context: ErrorContext
  ): Promise<RecoveryResult> {
    console.log(`📋 Queuing ${context.operation} for later retry`)
    
    const supabase = createClient()
    
    // Add to retry queue
    const { data, error: queueError } = await supabase
      .from('retry_queue')
      .insert({
        document_id: context.documentId,
        operation: context.operation,
        error_message: error.message,
        error_type: this.classifyError(error),
        context: context.metadata,
        retry_after: new Date(Date.now() + 60000).toISOString(), // Retry after 1 minute
        max_retries: this.MAX_RETRIES,
        current_retries: this.retryAttempts.get(`${context.operation}-${context.documentId}`) || 0
      })
    
    if (queueError) {
      console.error('Failed to queue for retry:', queueError)
    }
    
    return {
      success: false,
      strategy: RecoveryStrategy.QUEUE_FOR_LATER,
      message: 'Operation queued for later retry',
      retryAfter: 60000,
      data: { queueId: data?.[0]?.id }
    }
  }

  /**
   * Notify user about the error
   */
  private async notifyUser(
    error: Error,
    context: ErrorContext
  ): Promise<RecoveryResult> {
    console.log(`📢 Notifying user about ${context.operation} error`)
    
    // In a real application, this would send an email or push notification
    // For now, we'll just log it
    
    const userMessage = this.getUserFriendlyMessage(error, context)
    
    return {
      success: false,
      strategy: RecoveryStrategy.NOTIFY_USER,
      message: userMessage,
      data: { notified: true }
    }
  }

  /**
   * Log error and continue
   */
  private async logAndContinue(
    error: Error,
    context: ErrorContext
  ): Promise<RecoveryResult> {
    console.warn(`⚠️ Logging error and continuing: ${error.message}`)
    
    return {
      success: true,
      strategy: RecoveryStrategy.LOG_AND_CONTINUE,
      message: 'Error logged, continuing with operation',
      data: { logged: true }
    }
  }

  /**
   * Fail fast without recovery
   */
  private failFast(
    error: Error,
    context: ErrorContext
  ): RecoveryResult {
    console.error(`❌ Failing fast for ${context.operation}: ${error.message}`)
    
    return {
      success: false,
      strategy: RecoveryStrategy.FAIL_FAST,
      message: error.message,
      data: { failed: true }
    }
  }

  /**
   * Store error in database for persistence
   */
  private async storeErrorInDatabase(
    error: Error,
    context: ErrorContext,
    recovery: RecoveryResult
  ): Promise<void> {
    const supabase = createClient()
    
    try {
      await supabase
        .from('error_logs')
        .insert({
          document_id: context.documentId,
          user_id: context.userId,
          operation: context.operation,
          error_type: this.classifyError(error),
          error_message: error.message,
          error_stack: error.stack,
          context: context.metadata,
          recovery_strategy: recovery.strategy,
          recovery_success: recovery.success,
          created_at: new Date().toISOString()
        })
    } catch (logError) {
      console.error('Failed to log error to database:', logError)
    }
  }

  /**
   * Get user-friendly error message
   */
  private getUserFriendlyMessage(error: Error, context: ErrorContext): string {
    const errorType = this.classifyError(error)
    
    switch (errorType) {
      case ErrorType.NETWORK_ERROR:
        return 'Network connection issue. Please check your internet and try again.'
      
      case ErrorType.AUTH_ERROR:
        return 'Authentication required. Please log in and try again.'
      
      case ErrorType.STORAGE_ERROR:
        return 'File storage issue. Please try uploading again.'
      
      case ErrorType.PROCESSING_ERROR:
        return 'Document processing failed. We\'ll retry automatically.'
      
      case ErrorType.VALIDATION_ERROR:
        return 'Some fields contain invalid data. Please review and correct.'
      
      case ErrorType.QUOTA_EXCEEDED:
        return 'Processing limit reached. Please try again later.'
      
      default:
        return 'An unexpected error occurred. Please try again.'
    }
  }

  /**
   * Clear retry attempts for an operation
   */
  clearRetryAttempts(operation: string, documentId?: string): void {
    const retryKey = `${operation}-${documentId || 'global'}`
    this.retryAttempts.delete(retryKey)
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number
    errorsByType: Record<ErrorType, number>
    recoverySuccessRate: number
  } {
    const errorsByType: Record<ErrorType, number> = {} as any
    let successfulRecoveries = 0
    
    for (const log of this.errorLog) {
      const errorType = this.classifyError(log.error)
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1
      
      if (log.recovery.success) {
        successfulRecoveries++
      }
    }
    
    return {
      totalErrors: this.errorLog.length,
      errorsByType,
      recoverySuccessRate: this.errorLog.length > 0 
        ? (successfulRecoveries / this.errorLog.length) * 100 
        : 0
    }
  }
}