import { createServiceRoleClient } from '@/lib/supabase/server'
import { generateEmbeddings } from '@/lib/openai/client'
import { DocumentChunker, DocumentChunk } from './document-chunker'

export interface EmbeddingJob {
  documentId: string
  text: string
  pageBreaks?: number[]
  metadata?: Record<string, any>
}

export class EmbeddingService {
  private chunker: DocumentChunker

  constructor() {
    this.chunker = new DocumentChunker()
  }

  /**
   * Process document text and generate embeddings for semantic search
   */
  async processDocumentEmbeddings(job: EmbeddingJob): Promise<void> {
    const supabase = await createServiceRoleClient()
    
    try {
      // Delete existing chunks for this document (for reprocessing)
      await supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', job.documentId)

      // Chunk the document
      const chunks = job.pageBreaks
        ? this.chunker.chunkTextWithPages(job.text, job.pageBreaks, job.metadata)
        : this.chunker.chunkText(job.text, job.metadata)

      if (chunks.length === 0) {
        console.warn('No chunks created for document:', job.documentId)
        return
      }

      // Generate embeddings in batches to avoid rate limits
      const batchSize = 20
      const allChunksData = []

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize)
        const texts = batch.map(chunk => chunk.text)
        
        // Generate embeddings for batch
        const embeddings = await generateEmbeddings(texts)
        
        // Prepare data for insertion
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j]
          const embedding = embeddings[j]
          
          allChunksData.push({
            document_id: job.documentId,
            chunk_index: chunk.index,
            chunk_text: chunk.text,
            embedding: JSON.stringify(embedding), // Store as JSON, will be cast to vector
            page_number: chunk.pageNumber || null,
            metadata: chunk.metadata || null,
          })
        }

        // Add delay between batches to respect rate limits
        if (i + batchSize < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      // Insert all chunks with embeddings
      const { error } = await supabase
        .from('document_chunks')
        .insert(allChunksData)

      if (error) {
        throw new Error(`Failed to store embeddings: ${error.message}`)
      }

      console.log(`Successfully created ${allChunksData.length} embeddings for document ${job.documentId}`)
    } catch (error) {
      console.error('Error processing document embeddings:', error)
      throw error
    }
  }

  /**
   * Search for similar document chunks using vector similarity
   */
  async searchSimilarChunks(
    query: string,
    documentId?: string,
    limit: number = 5
  ): Promise<any[]> {
    const supabase = await createServiceRoleClient()
    
    try {
      // Generate embedding for the query
      const { generateEmbedding } = await import('@/lib/openai/client')
      const queryEmbedding = await generateEmbedding(query)
      
      // Call the vector search function
      const { data, error } = await supabase.rpc('search_document_chunks', {
        query_embedding: queryEmbedding,
        match_count: limit,
        filter_document_id: documentId || null,
      })

      if (error) {
        throw new Error(`Vector search failed: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('Error searching similar chunks:', error)
      throw error
    }
  }

  /**
   * Get relevant context for a query from document chunks
   */
  async getRelevantContext(
    query: string,
    documentId: string,
    maxChunks: number = 5
  ): Promise<string> {
    const similarChunks = await this.searchSimilarChunks(query, documentId, maxChunks)
    
    if (similarChunks.length === 0) {
      return ''
    }

    // Sort by similarity score and chunk index to maintain order
    similarChunks.sort((a, b) => {
      if (Math.abs(a.similarity - b.similarity) < 0.01) {
        return a.chunk_index - b.chunk_index
      }
      return b.similarity - a.similarity
    })

    // Combine chunks into context
    const context = similarChunks
      .map(chunk => {
        const pageInfo = chunk.page_number ? ` [Page ${chunk.page_number}]` : ''
        return `${chunk.chunk_text}${pageInfo}`
      })
      .join('\n\n')

    return context
  }
}