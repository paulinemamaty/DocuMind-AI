'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface UploadedFile {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed'
  progress?: number
  documentId?: string
  error?: string
}

export function DocumentUpload() {
  const [files, setFiles] = useState<UploadedFile[]>([])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      status: 'pending' as const,
    }))
    setFiles(prev => [...prev, ...newFiles])
    
    // Start uploading files
    newFiles.forEach(uploadFile)
  }, [])

  const uploadFile = async (uploadedFile: UploadedFile) => {
    // Update status to uploading
    setFiles(prev => prev.map(f => 
      f.id === uploadedFile.id ? { ...f, status: 'uploading' } : f
    ))

    const formData = new FormData()
    formData.append('file', uploadedFile.file)

    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      // Update status to processing
      setFiles(prev => prev.map(f => 
        f.id === uploadedFile.id 
          ? { ...f, status: 'processing', documentId: data.document.id } 
          : f
      ))

      // Poll for processing status
      pollDocumentStatus(uploadedFile.id, data.document.id)
    } catch (error) {
      // Update status to failed
      setFiles(prev => prev.map(f => 
        f.id === uploadedFile.id 
          ? { ...f, status: 'failed', error: error instanceof Error ? error.message : 'Upload failed' } 
          : f
      ))
    }
  }

  const pollDocumentStatus = async (fileId: string, documentId: string) => {
    let attempts = 0
    const maxAttempts = 60 // Poll for up to 5 minutes (60 * 5 seconds)
    
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}/status`)
        const data = await response.json()

        if (data.status === 'completed') {
          setFiles(prev => prev.map(f => 
            f.id === fileId ? { ...f, status: 'completed' } : f
          ))
          return true
        } else if (data.status === 'failed') {
          setFiles(prev => prev.map(f => 
            f.id === fileId ? { ...f, status: 'failed', error: 'Processing failed' } : f
          ))
          return true
        }
        return false
      } catch (error) {
        console.error('Status check error:', error)
        return false
      }
    }

    const interval = setInterval(async () => {
      attempts++
      const isDone = await checkStatus()
      
      if (isDone || attempts >= maxAttempts) {
        clearInterval(interval)
        if (attempts >= maxAttempts) {
          setFiles(prev => prev.map(f => 
            f.id === fileId ? { ...f, status: 'failed', error: 'Processing timeout' } : f
          ))
        }
      }
    }, 5000) // Check every 5 seconds
  }

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true,
  })

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
          isDragActive 
            ? "border-primary bg-primary/5" 
            : "border-border hover:border-primary/50"
        )}
      >
        <input {...getInputProps()} />
        
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        
        {isDragActive ? (
          <p className="text-lg font-medium">Drop your documents here...</p>
        ) : (
          <>
            <p className="text-lg font-medium mb-2">
              Drag & drop documents here, or click to browse
            </p>
            <p className="text-sm text-muted-foreground">
              Supports PDF, PNG, JPEG, and other image formats (max 10MB)
            </p>
          </>
        )}
      </div>

      {files.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="text-lg font-semibold">Uploaded Documents</h3>
          
          {files.map(file => (
            <Card
              key={file.id}
              className="flex items-center justify-between p-4"
            >
              <div className="flex items-center space-x-3">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{file.file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {file.status === 'pending' && (
                  <span className="text-sm text-muted-foreground">Waiting...</span>
                )}
                
                {file.status === 'uploading' && (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Uploading...</span>
                  </div>
                )}
                
                {file.status === 'processing' && (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    <span className="text-sm text-blue-500">Processing with AI...</span>
                  </div>
                )}
                
                {file.status === 'completed' && (
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-500">Ready</span>
                    {file.documentId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.location.href = `/documents/${file.documentId}`}
                      >
                        View
                      </Button>
                    )}
                  </div>
                )}
                
                {file.status === 'failed' && (
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-destructive">
                      {file.error || 'Failed'}
                    </span>
                  </div>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeFile(file.id)}
                  disabled={file.status === 'uploading' || file.status === 'processing'}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}