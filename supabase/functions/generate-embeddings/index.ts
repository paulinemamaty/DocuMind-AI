import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'
import { Configuration, OpenAIApi } from 'https://esm.sh/openai@3.3.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmbeddingRequest {
  documentId?: string
  documentIds?: string[]
  text?: string
  chunkSize?: number
  chunkOverlap?: number
  batchSize?: number
}

interface ChunkMetadata {
  documentId: string
  chunkIndex: number
  pageNumber?: number
  startChar: number
  endChar: number
  section?: string
}

class EmbeddingsGenerator {
  private supabase: any
  private openai: OpenAIApi
  private embeddingModel = 'text-embedding-3-small'
  private maxTokensPerChunk = 8000 // Conservative limit for embeddings model
  
  constructor(supabase: any, openaiApiKey: string) {
    this.supabase = supabase
    const configuration = new Configuration({ apiKey: openaiApiKey })
    this.openai = new OpenAIApi(configuration)
  }

  // Split text into chunks with overlap
  private splitTextIntoChunks(
    text: string,
    chunkSize: number = 1500,
    overlap: number = 200
  ): string[] {
    const chunks: string[] = []
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
    
    let currentChunk = ''
    let currentLength = 0
    
    for (const sentence of sentences) {
      const sentenceLength = sentence.length
      
      if (currentLength + sentenceLength > chunkSize && currentChunk) {
        chunks.push(currentChunk.trim())
        
        // Add overlap from the end of the current chunk
        const overlapText = currentChunk.slice(-overlap)
        currentChunk = overlapText + sentence
        currentLength = overlapText.length + sentenceLength
      } else {
        currentChunk += sentence
        currentLength += sentenceLength
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim())
    }
    
    return chunks
  }

  // Generate embeddings for text chunks
  async generateEmbeddings(chunks: string[], batchSize: number = 10): Promise<number[][]> {
    const embeddings: number[][] = []
    
    // Process in batches to avoid rate limits
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      
      try {
        const response = await this.openai.createEmbedding({
          model: this.embeddingModel,
          input: batch,
        })
        
        for (const embedding of response.data.data) {
          embeddings.push(embedding.embedding)
        }
        
        // Rate limiting delay
        if (i + batchSize < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error: any) {
        console.error(`Failed to generate embeddings for batch ${i / batchSize}:`, error.message)
        // Add empty embeddings for failed chunks
        for (let j = 0; j < batch.length; j++) {
          embeddings.push(new Array(1536).fill(0)) // Default dimension for text-embedding-3-small
        }
      }
    }
    
    return embeddings
  }

  // Process a single document
  async processDocument(
    documentId: string,
    chunkSize: number = 1500,
    chunkOverlap: number = 200,
    batchSize: number = 10
  ): Promise<{ chunksCreated: number; processingTime: number }> {
    const startTime = Date.now()
    
    try {
      // Get document and its extraction
      const { data: document, error: docError } = await this.supabase
        .from('documents')
        .select('*, document_extractions(*)')
        .eq('id', documentId)
        .single()
      
      if (docError || !document) {
        throw new Error('Document not found')
      }
      
      const extraction = document.document_extractions?.[0]
      if (!extraction || !extraction.full_text) {
        throw new Error('No text extraction found for document')
      }
      
      // Split text into chunks
      const chunks = this.splitTextIntoChunks(
        extraction.full_text,
        chunkSize,
        chunkOverlap
      )
      
      // Generate embeddings
      const embeddings = await this.generateEmbeddings(chunks, batchSize)
      
      // Delete existing chunks for this document
      await this.supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', documentId)
      
      // Store chunks with embeddings
      const chunkRecords = chunks.map((chunk, index) => ({
        document_id: documentId,
        chunk_index: index,
        content: chunk,
        embedding: embeddings[index],
        metadata: {
          chunkSize,
          chunkOverlap,
          totalChunks: chunks.length,
          characterCount: chunk.length,
          position: {
            start: index * (chunkSize - chunkOverlap),
            end: (index * (chunkSize - chunkOverlap)) + chunk.length
          }
        }
      }))
      
      // Insert in batches to avoid payload size limits
      const insertBatchSize = 50
      for (let i = 0; i < chunkRecords.length; i += insertBatchSize) {
        const batch = chunkRecords.slice(i, i + insertBatchSize)
        const { error: insertError } = await this.supabase
          .from('document_chunks')
          .insert(batch)
        
        if (insertError) {
          console.error(`Failed to insert chunk batch ${i / insertBatchSize}:`, insertError)
        }
      }
      
      // Update document metadata
      await this.supabase
        .from('documents')
        .update({
          metadata: {
            ...document.metadata,
            embeddingsGenerated: true,
            totalChunks: chunks.length,
            embeddingModel: this.embeddingModel,
            chunkingParams: { chunkSize, chunkOverlap }
          }
        })
        .eq('id', documentId)
      
      const processingTime = Date.now() - startTime
      
      return {
        chunksCreated: chunks.length,
        processingTime
      }
      
    } catch (error: any) {
      console.error(`Failed to process document ${documentId}:`, error.message)
      
      // Update document with error
      await this.supabase
        .from('documents')
        .update({
          processing_error: `Embedding generation failed: ${error.message}`
        })
        .eq('id', documentId)
      
      throw error
    }
  }

  // Process multiple documents in batch
  async processBatch(
    documentIds: string[],
    chunkSize: number = 1500,
    chunkOverlap: number = 200,
    batchSize: number = 10
  ): Promise<{ results: any[], totalTime: number }> {
    const startTime = Date.now()
    const results = []
    
    for (const documentId of documentIds) {
      try {
        const result = await this.processDocument(
          documentId,
          chunkSize,
          chunkOverlap,
          batchSize
        )
        results.push({
          documentId,
          status: 'success',
          ...result
        })
      } catch (error: any) {
        results.push({
          documentId,
          status: 'failed',
          error: error.message
        })
      }
    }
    
    const totalTime = Date.now() - startTime
    return { results, totalTime }
  }

  // Generate embedding for a single text query
  async generateQueryEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.createEmbedding({
        model: this.embeddingModel,
        input: text,
      })
      
      return response.data.data[0].embedding
    } catch (error: any) {
      console.error('Failed to generate query embedding:', error.message)
      throw error
    }
  }

  // Search similar chunks using vector similarity
  async searchSimilarChunks(
    queryEmbedding: number[],
    documentId?: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<any[]> {
    let query = this.supabase
      .rpc('search_chunks', {
        query_embedding: queryEmbedding,
        similarity_threshold: threshold,
        match_count: limit
      })
    
    if (documentId) {
      query = query.eq('document_id', documentId)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Failed to search similar chunks:', error)
      return []
    }
    
    return data || []
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const generator = new EmbeddingsGenerator(supabase, openaiApiKey)
    
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'generate'
    
    switch (action) {
      case 'generate': {
        const {
          documentId,
          documentIds,
          text,
          chunkSize = 1500,
          chunkOverlap = 200,
          batchSize = 10
        } = await req.json() as EmbeddingRequest
        
        if (text) {
          // Generate embedding for raw text
          const embedding = await generator.generateQueryEmbedding(text)
          
          return new Response(
            JSON.stringify({
              success: true,
              embedding,
              dimension: embedding.length
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        if (documentIds && documentIds.length > 0) {
          // Process multiple documents
          const result = await generator.processBatch(
            documentIds,
            chunkSize,
            chunkOverlap,
            batchSize
          )
          
          return new Response(
            JSON.stringify({
              success: true,
              ...result
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        if (documentId) {
          // Process single document
          const result = await generator.processDocument(
            documentId,
            chunkSize,
            chunkOverlap,
            batchSize
          )
          
          return new Response(
            JSON.stringify({
              success: true,
              documentId,
              ...result
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        throw new Error('No document ID or text provided')
      }
      
      case 'search': {
        const { query, documentId, limit = 10, threshold = 0.7 } = await req.json()
        
        if (!query) {
          throw new Error('Query text is required')
        }
        
        // Generate query embedding
        const queryEmbedding = await generator.generateQueryEmbedding(query)
        
        // Search similar chunks
        const results = await generator.searchSimilarChunks(
          queryEmbedding,
          documentId,
          limit,
          threshold
        )
        
        return new Response(
          JSON.stringify({
            success: true,
            results,
            count: results.length
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      case 'regenerate': {
        const { documentId } = await req.json()
        
        if (!documentId) {
          throw new Error('Document ID is required')
        }
        
        // Delete existing chunks
        await supabase
          .from('document_chunks')
          .delete()
          .eq('document_id', documentId)
        
        // Regenerate embeddings
        const result = await generator.processDocument(documentId)
        
        return new Response(
          JSON.stringify({
            success: true,
            documentId,
            ...result
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      default:
        throw new Error('Invalid action')
    }
    
  } catch (error: any) {
    console.error('Embeddings generation error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})