'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  FileText,
  AlertCircle 
} from 'lucide-react'

interface ProcessingStatusProps {
  documentId: string
  onStatusChange?: (status: string) => void
}

interface DocumentStatus {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  processing_error?: string
  processing_attempts?: number
  created_at: string
  updated_at: string
}

interface QueueStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  attempts: number
  error?: string
  processor_types?: string[]
  started_at?: string
  completed_at?: string
}

export function ProcessingStatus({ documentId, onStatusChange }: ProcessingStatusProps) {
  const [document, setDocument] = useState<DocumentStatus | null>(null)
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null)
  const [progress, setProgress] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    // Initial load
    loadStatus()
    
    // Set up real-time subscription
    const channel = supabase
      .channel(`document-${documentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `id=eq.${documentId}`
        },
        (payload) => {
          const newDoc = payload.new as DocumentStatus
          setDocument(newDoc)
          updateProgress(newDoc.status)
          if (onStatusChange) {
            onStatusChange(newDoc.status)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'processing_queue',
          filter: `document_id=eq.${documentId}`
        },
        (payload) => {
          const queue = payload.new as QueueStatus
          setQueueStatus(queue)
          updateProgress(queue.status)
        }
      )
      .subscribe()

    // Poll for updates every 5 seconds as backup
    const interval = setInterval(loadStatus, 5000)

    return () => {
      channel.unsubscribe()
      clearInterval(interval)
    }
  }, [documentId])

  const loadStatus = async () => {
    // Load document status
    const { data: doc } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()
    
    if (doc) {
      setDocument(doc)
      updateProgress(doc.status)
    }

    // Load queue status
    const { data: queue } = await supabase
      .from('processing_queue')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (queue) {
      setQueueStatus(queue)
    }
  }

  const updateProgress = (status: string) => {
    switch (status) {
      case 'pending':
        setProgress(25)
        break
      case 'processing':
        setProgress(60)
        break
      case 'completed':
        setProgress(100)
        break
      case 'failed':
        setProgress(0)
        break
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'processing':
        return <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-600" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50'
      case 'processing':
        return 'text-blue-600 bg-blue-50'
      case 'failed':
        return 'text-red-600 bg-red-50'
      case 'pending':
        return 'text-yellow-600 bg-yellow-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getProcessingSteps = () => {
    const steps = [
      { name: 'Upload', completed: true },
      { name: 'Queue', completed: !!queueStatus },
      { name: 'OCR Processing', completed: document?.status === 'processing' || document?.status === 'completed' },
      { name: 'Form Detection', completed: document?.status === 'completed' },
      { name: 'Embeddings', completed: document?.status === 'completed' },
      { name: 'Complete', completed: document?.status === 'completed' }
    ]
    return steps
  }

  if (!document) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading status...</span>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4 space-y-4">
      {/* Main Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <span className="font-medium">Processing Status</span>
        </div>
        <Badge className={getStatusColor(document.status)}>
          <span className="flex items-center gap-1">
            {getStatusIcon(document.status)}
            {document.status}
          </span>
        </Badge>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Processing Steps */}
      <div className="space-y-2">
        <span className="text-sm font-medium">Processing Steps</span>
        <div className="space-y-1">
          {getProcessingSteps().map((step, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              {step.completed ? (
                <CheckCircle className="h-3 w-3 text-green-600" />
              ) : (
                <div className="h-3 w-3 rounded-full border border-gray-300" />
              )}
              <span className={step.completed ? 'text-foreground' : 'text-muted-foreground'}>
                {step.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Queue Info */}
      {queueStatus && (
        <div className="pt-2 border-t space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Queue Status:</span>
            <span className="font-medium">{queueStatus.status}</span>
          </div>
          {queueStatus.processor_types && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Processors:</span>
              <span className="font-medium">{queueStatus.processor_types.join(', ')}</span>
            </div>
          )}
          {queueStatus.attempts > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Attempts:</span>
              <span className="font-medium">{queueStatus.attempts}</span>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {document.processing_error && (
        <div className="pt-2 border-t">
          <div className="flex items-start gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <span>{document.processing_error}</span>
          </div>
        </div>
      )}

      {/* Timing Info */}
      {document.status === 'completed' && queueStatus?.completed_at && (
        <div className="pt-2 border-t text-sm text-muted-foreground">
          Processing completed in {
            Math.round((new Date(queueStatus.completed_at).getTime() - new Date(document.created_at).getTime()) / 1000)
          } seconds
        </div>
      )}
    </Card>
  )
}