'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

// Dynamically import the PDF viewer to avoid SSR issues
const PDFViewer = dynamic(
  () => import('./pdf-viewer-client').then(mod => ({ default: mod.PDFViewerClient })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600 font-medium">Loading PDF viewer...</p>
        </div>
      </div>
    ),
  }
)

export { PDFViewer }