export const SUPPORTED_MIME_TYPES = {
  PDF: 'application/pdf',
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  JPG: 'image/jpg',
  TIFF: 'image/tiff',
  GIF: 'image/gif',
  BMP: 'image/bmp',
  WEBP: 'image/webp',
} as const

export type SupportedMimeType = typeof SUPPORTED_MIME_TYPES[keyof typeof SUPPORTED_MIME_TYPES]

export function isSupportedMimeType(mimeType: string): boolean {
  return Object.values(SUPPORTED_MIME_TYPES).includes(mimeType as SupportedMimeType)
}

export function getMimeTypeFromExtension(filename: string): string | null {
  const extension = filename.split('.').pop()?.toLowerCase()
  
  switch (extension) {
    case 'pdf':
      return SUPPORTED_MIME_TYPES.PDF
    case 'png':
      return SUPPORTED_MIME_TYPES.PNG
    case 'jpg':
    case 'jpeg':
      return SUPPORTED_MIME_TYPES.JPEG
    case 'tiff':
    case 'tif':
      return SUPPORTED_MIME_TYPES.TIFF
    case 'gif':
      return SUPPORTED_MIME_TYPES.GIF
    case 'bmp':
      return SUPPORTED_MIME_TYPES.BMP
    case 'webp':
      return SUPPORTED_MIME_TYPES.WEBP
    default:
      return null
  }
}

export interface DocumentMetadata {
  pageCount?: number
  width?: number
  height?: number
  formFieldCount?: number
  tableCount?: number
  hasSignatureFields?: boolean
}

export function extractDocumentMetadata(processingResult: any): DocumentMetadata {
  const metadata: DocumentMetadata = {}

  if (processingResult.pages) {
    metadata.pageCount = processingResult.pages.length
    if (processingResult.pages[0]) {
      metadata.width = processingResult.pages[0].width
      metadata.height = processingResult.pages[0].height
    }
  }

  if (processingResult.formFields) {
    metadata.formFieldCount = processingResult.formFields.length
    metadata.hasSignatureFields = processingResult.formFields.some(
      (field: any) => field.fieldType === 'signature'
    )
  }

  if (processingResult.tables) {
    metadata.tableCount = processingResult.tables.length
  }

  return metadata
}