'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  FileText, 
  Loader2, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ArrowRight,
  Calendar,
  HardDrive,
  Sparkles,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface Document {
  id: string
  filename: string
  file_size: number
  mime_type: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  metadata?: any
}

export function DocumentsList() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchDocuments()
    
    // Subscribe to realtime updates
    const subscription = supabase
      .channel('documents')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setDocuments(prev => 
              prev.map(doc => 
                doc.id === payload.new.id ? payload.new as Document : doc
              )
            )
          } else if (payload.eventType === 'INSERT') {
            setDocuments(prev => [payload.new as Document, ...prev])
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchDocuments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching documents:', error)
      } else {
        setDocuments(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return null
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Queued'
      case 'processing':
        return 'Processing'
      case 'completed':
        return 'Ready'
      case 'failed':
        return 'Failed'
      default:
        return status
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  }

  const getMimeTypeIcon = (mimeType: string) => {
    if (mimeType === 'application/pdf') {
      return <FileText className="h-5 w-5 text-blue-600" />
    } else if (mimeType.startsWith('image/')) {
      return <FileText className="h-5 w-5 text-purple-600" />
    } else {
      return <FileText className="h-5 w-5 text-gray-600" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <Card className="text-center p-12 bg-gradient-to-br from-gray-50 to-white">
        <CardContent>
          <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No documents yet</h3>
          <p className="text-gray-500 mb-6">
            Upload your first document to get started with AI-powered analysis
          </p>
          <Button onClick={() => window.location.href = '/documents'}>
            Upload Document
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Your Documents</h2>
          <p className="text-gray-500 text-sm mt-1">
            {documents.length} document{documents.length !== 1 ? 's' : ''} in your workspace
          </p>
        </div>
        <Button onClick={() => {
          const tabsList = document.querySelector('[role="tablist"]')
          const uploadTab = tabsList?.querySelector('[value="upload"]') as HTMLButtonElement
          uploadTab?.click()
        }}>
          Upload New
        </Button>
      </div>
      
      <div className="grid gap-4">
        {documents.map(doc => (
          <Card
            key={doc.id}
            className={cn(
              "hover:shadow-lg transition-all duration-200 cursor-pointer",
              doc.status === 'completed' && "hover:scale-[1.02]"
            )}
            onClick={() => doc.status === 'completed' && (window.location.href = `/documents/${doc.id}`)}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  {/* File Icon */}
                  <div className="h-12 w-12 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg flex items-center justify-center">
                    {getMimeTypeIcon(doc.mime_type)}
                  </div>
                  
                  {/* Document Info */}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">{doc.filename}</h3>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                      <div className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {formatFileSize(doc.file_size)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(doc.created_at), 'MMM d, yyyy')}
                      </div>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(doc.status)}
                        <span className={cn(
                          "font-medium",
                          doc.status === 'completed' && "text-green-600",
                          doc.status === 'processing' && "text-blue-600",
                          doc.status === 'failed' && "text-red-600"
                        )}>
                          {getStatusText(doc.status)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Metadata Pills */}
                    {doc.status === 'completed' && doc.metadata && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {doc.metadata.formFieldCount > 0 && (
                          <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
                            <FileText className="h-3 w-3" />
                            {doc.metadata.formFieldCount} form fields
                          </div>
                        )}
                        {doc.metadata.tableCount > 0 && (
                          <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-full text-xs">
                            <FileText className="h-3 w-3" />
                            {doc.metadata.tableCount} tables
                          </div>
                        )}
                        {doc.metadata.embeddingsGenerated && (
                          <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs">
                            <Sparkles className="h-3 w-3" />
                            AI-ready
                          </div>
                        )}
                        {doc.metadata.pageCount && (
                          <div className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 text-gray-700 rounded-full text-xs">
                            {doc.metadata.pageCount} pages
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Error Message */}
                    {doc.status === 'failed' && doc.metadata?.error && (
                      <div className="flex items-start gap-2 mt-2 p-2 bg-red-50 rounded-lg">
                        <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                        <p className="text-xs text-red-700">{doc.metadata.error}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                <div className="ml-4">
                  {doc.status === 'completed' && (
                    <Button
                      size="sm"
                      className="group"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.location.href = `/documents/${doc.id}`
                      }}
                    >
                      Open
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  )}
                  
                  {doc.status === 'processing' && (
                    <div className="text-sm text-blue-600 font-medium">
                      Processing...
                    </div>
                  )}
                  
                  {doc.status === 'failed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        // Retry processing
                        fetch('/api/documents/process', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ documentId: doc.id })
                        })
                      }}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}