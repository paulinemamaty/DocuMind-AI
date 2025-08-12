import { openAIConfig } from '@/lib/openai/config'

export interface DocumentChunk {
  text: string
  index: number
  pageNumber?: number
  metadata?: Record<string, any>
}

export class DocumentChunker {
  private chunkSize: number
  private chunkOverlap: number

  constructor(
    chunkSize: number = openAIConfig.embeddings.chunkSize,
    chunkOverlap: number = openAIConfig.embeddings.chunkOverlap
  ) {
    this.chunkSize = chunkSize
    this.chunkOverlap = chunkOverlap
  }

  /**
   * Chunks text into overlapping segments for better context preservation
   */
  chunkText(text: string, metadata?: Record<string, any>): DocumentChunk[] {
    const chunks: DocumentChunk[] = []
    const sentences = this.splitIntoSentences(text)
    
    let currentChunk = ''
    let currentIndex = 0
    let sentenceBuffer: string[] = []

    for (const sentence of sentences) {
      sentenceBuffer.push(sentence)
      currentChunk = sentenceBuffer.join(' ')

      if (currentChunk.length >= this.chunkSize) {
        chunks.push({
          text: currentChunk.trim(),
          index: currentIndex,
          metadata,
        })
        currentIndex++

        // Calculate overlap
        const overlapSize = Math.floor(sentenceBuffer.length * (this.chunkOverlap / this.chunkSize))
        sentenceBuffer = sentenceBuffer.slice(-overlapSize)
        currentChunk = sentenceBuffer.join(' ')
      }
    }

    // Add remaining text as final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        index: currentIndex,
        metadata,
      })
    }

    return chunks
  }

  /**
   * Chunks text with page information preserved
   */
  chunkTextWithPages(
    text: string,
    pageBreaks: number[],
    metadata?: Record<string, any>
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = []
    let currentPosition = 0
    let currentPage = 1

    // Split text by pages first
    const pages: { text: string; pageNumber: number }[] = []
    
    for (let i = 0; i < pageBreaks.length; i++) {
      const pageEnd = pageBreaks[i]
      const pageText = text.substring(currentPosition, pageEnd)
      pages.push({ text: pageText, pageNumber: currentPage })
      currentPosition = pageEnd
      currentPage++
    }

    // Add remaining text as last page
    if (currentPosition < text.length) {
      pages.push({ 
        text: text.substring(currentPosition), 
        pageNumber: currentPage 
      })
    }

    // Chunk each page
    let globalIndex = 0
    for (const page of pages) {
      const pageChunks = this.chunkText(page.text, metadata)
      
      for (const chunk of pageChunks) {
        chunks.push({
          ...chunk,
          index: globalIndex++,
          pageNumber: page.pageNumber,
        })
      }
    }

    return chunks
  }

  /**
   * Smart sentence splitting that handles common abbreviations
   */
  private splitIntoSentences(text: string): string[] {
    // Replace common abbreviations to avoid false sentence breaks
    const abbreviations = ['Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Prof.', 'Sr.', 'Jr.', 'Ph.D', 'M.D', 'B.A', 'M.A', 'B.S', 'M.S']
    let processedText = text
    
    abbreviations.forEach(abbr => {
      processedText = processedText.replace(new RegExp(abbr.replace('.', '\\.'), 'g'), abbr.replace('.', '<!DOT!>'))
    })

    // Split by sentence endings
    const sentences = processedText.split(/(?<=[.!?])\s+/)
    
    // Restore dots in abbreviations
    return sentences.map(sentence => sentence.replace(/<!DOT!>/g, '.'))
  }

  /**
   * Calculates optimal chunk size based on token limits
   */
  static calculateOptimalChunkSize(text: string, maxTokens: number = 400): number {
    // Rough estimation: 1 token ≈ 4 characters
    const estimatedTokens = text.length / 4
    
    if (estimatedTokens <= maxTokens) {
      return text.length
    }
    
    // Calculate chunk size to stay under token limit
    return Math.floor(maxTokens * 4)
  }
}