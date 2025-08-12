'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Loader2, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

interface PDFViewerProps {
  url: string | null
  className?: string
  onPageChange?: (page: number) => void
  onLoadSuccess?: (numPages: number) => void
  onLoadError?: (error: Error) => void
  showControls?: boolean
  initialPage?: number
  initialZoom?: number
}

export function PDFViewerClient({ 
  url, 
  className = '',
  onPageChange,
  onLoadSuccess,
  onLoadError,
  showControls = true,
  initialPage = 1,
  initialZoom = 1
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(initialPage)
  const [scale, setScale] = useState(initialZoom)
  const [rotation, setRotation] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setLoading(false)
    setError(null)
    if (onLoadSuccess) {
      onLoadSuccess(numPages)
    }
  }, [onLoadSuccess])

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('PDF load error:', error)
    setLoading(false)
    setError(error.message || 'Failed to load PDF')
    if (onLoadError) {
      onLoadError(error)
    }
  }, [onLoadError])

  const changePage = (offset: number) => {
    const newPage = pageNumber + offset
    if (newPage >= 1 && newPage <= (numPages || 1)) {
      setPageNumber(newPage)
      if (onPageChange) {
        onPageChange(newPage)
      }
    }
  }

  const changeZoom = (delta: number) => {
    setScale(prevScale => Math.max(0.5, Math.min(3, prevScale + delta)))
  }

  const rotate = () => {
    setRotation(prev => (prev + 90) % 360)
  }

  if (!url) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 ${className}`}>
        <div className="text-center p-8">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg font-medium">No document selected</p>
          <p className="text-gray-500 text-sm mt-2">Please select a document to view</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative w-full h-full flex flex-col bg-gray-50 ${className}`}>
      {/* Controls */}
      {showControls && (
        <div className="flex items-center justify-between p-3 bg-white border-b">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => changePage(-1)}
              disabled={pageNumber <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600 min-w-[100px] text-center">
              Page {pageNumber} of {numPages || '...'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => changePage(1)}
              disabled={pageNumber >= (numPages || 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => changeZoom(-0.1)}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600 min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => changeZoom(0.1)}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={rotate}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* PDF Content */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="text-sm text-gray-600">Loading document...</span>
            </div>
          }
          error={
            <div className="text-center p-4">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-600 text-sm">Error loading document</p>
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            rotate={rotation}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className="shadow-lg"
            loading={
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            }
          />
        </Document>
      </div>
    </div>
  )
}