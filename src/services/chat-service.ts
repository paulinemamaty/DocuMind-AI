import { getOpenAIClient } from '@/lib/openai/client'
import { openAIConfig, SYSTEM_PROMPT } from '@/lib/openai/config'
import { EmbeddingService } from './embedding-service'
import { createServiceRoleClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  citations?: Citation[]
}

export interface Citation {
  pageNumber?: number
  text: string
  relevance: number
  chunkIndex?: number
}

export interface ChatSession {
  id: string
  documentId: string
  userId: string
  messages: ChatMessage[]
}

export class ChatService {
  private embeddingService: EmbeddingService

  constructor() {
    this.embeddingService = new EmbeddingService()
  }

  /**
   * Create or get existing chat session for a document
   */
  async getOrCreateSession(
    documentId: string,
    userId: string
  ): Promise<ChatSession> {
    const supabase = await createServiceRoleClient()

    // Check for existing session
    const { data: existing } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('document_id', documentId)
      .eq('user_id', userId)
      .single()

    if (existing) {
      return {
        id: existing.id,
        documentId: existing.document_id,
        userId: existing.user_id,
        messages: existing.messages as ChatMessage[],
      }
    }

    // Create new session
    const { data: newSession, error } = await supabase
      .from('chat_sessions')
      .insert({
        document_id: documentId,
        user_id: userId,
        messages: [],
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create chat session: ${error.message}`)
    }

    return {
      id: newSession.id,
      documentId: newSession.document_id,
      userId: newSession.user_id,
      messages: [],
    }
  }

  /**
   * Search for relevant chunks with citation information
   */
  async searchSimilarChunksWithCitations(
    query: string,
    documentId: string,
    limit: number = 5
  ): Promise<Citation[]> {
    const supabase = await createServiceRoleClient()
    const { generateEmbedding } = await import('@/lib/openai/client')
    const queryEmbedding = await generateEmbedding(query)
    
    const { data, error } = await supabase.rpc('search_document_chunks', {
      query_embedding: queryEmbedding,
      match_count: limit,
      filter_document_id: documentId || null,
    })

    if (error) {
      console.error('Vector search failed:', error)
      return []
    }

    return (data || []).map((chunk: any) => ({
      text: chunk.chunk_text,
      pageNumber: chunk.page_number || undefined,
      relevance: chunk.similarity || 0,
      chunkIndex: chunk.chunk_index,
    }))
  }

  /**
   * Generate a streaming chat response with RAG and citations
   */
  async *generateStreamingResponse(
    sessionId: string,
    userMessage: string,
    documentId: string
  ): AsyncGenerator<string, void, unknown> {
    const client = getOpenAIClient()
    
    try {
      // Get relevant chunks with citation info
      const citations = await this.searchSimilarChunksWithCitations(
        userMessage,
        documentId,
        5
      )

      // Build context from citations with reference numbers
      const context = citations
        .map((citation, index) => {
          const pageInfo = citation.pageNumber ? ` [Page ${citation.pageNumber}]` : ''
          return `[${index + 1}] ${citation.text}${pageInfo}`
        })
        .join('\n\n')

      // Build the prompt with context and citation instructions
      const contextPrompt = context
        ? `Here is the relevant document context. When referencing information, use citation numbers like [1], [2], etc.:\n\n${context}\n\n`
        : ''

      const fullPrompt = `${contextPrompt}User Question: ${userMessage}\n\nProvide a helpful answer based on the document context. Include citation numbers [1], [2], etc. when referencing specific information.`

      // Get existing messages for context
      const supabase = await createServiceRoleClient()
      const { data: session } = await supabase
        .from('chat_sessions')
        .select('messages')
        .eq('id', sessionId)
        .single()

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { 
          role: 'system', 
          content: SYSTEM_PROMPT + '\n\nWhen you reference information from the provided context, include citation numbers like [1], [2], etc. to indicate which source you are referencing.'
        },
      ]

      // Add conversation history (last 10 messages for context)
      if (session?.messages) {
        const history = (session.messages as ChatMessage[]).slice(-10)
        history.forEach(msg => {
          messages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })
        })
      }

      // Add current message with context
      messages.push({ role: 'user', content: fullPrompt })

      // Create streaming completion
      const stream = await client.chat.completions.create({
        model: openAIConfig.models.chat,
        messages,
        temperature: openAIConfig.chat.temperature,
        max_tokens: openAIConfig.chat.maxTokens,
        top_p: openAIConfig.chat.topP,
        frequency_penalty: openAIConfig.chat.frequencyPenalty,
        presence_penalty: openAIConfig.chat.presencePenalty,
        stream: true,
      })

      let fullResponse = ''

      // Stream the response
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || ''
        fullResponse += content
        yield content
      }

      // Save the conversation to database with citations
      await this.saveMessage(sessionId, { role: 'user', content: userMessage })
      await this.saveMessage(sessionId, { 
        role: 'assistant', 
        content: fullResponse,
        citations: citations
      })

    } catch (error) {
      console.error('Error generating chat response:', error)
      yield 'I apologize, but I encountered an error while processing your request. Please try again.'
    }
  }

  /**
   * Generate a non-streaming chat response with citations
   */
  async generateResponse(
    sessionId: string,
    userMessage: string,
    documentId: string
  ): Promise<string> {
    const client = getOpenAIClient()
    
    try {
      // Get relevant chunks with citation info
      const citations = await this.searchSimilarChunksWithCitations(
        userMessage,
        documentId,
        5
      )

      // Build context from citations with reference numbers
      const context = citations
        .map((citation, index) => {
          const pageInfo = citation.pageNumber ? ` [Page ${citation.pageNumber}]` : ''
          return `[${index + 1}] ${citation.text}${pageInfo}`
        })
        .join('\n\n')

      const contextPrompt = context
        ? `Here is the relevant document context. When referencing information, use citation numbers like [1], [2], etc.:\n\n${context}\n\n`
        : ''

      const fullPrompt = `${contextPrompt}User Question: ${userMessage}\n\nProvide a helpful answer based on the document context. Include citation numbers [1], [2], etc. when referencing specific information.`

      // Get session history
      const supabase = await createServiceRoleClient()
      const { data: session } = await supabase
        .from('chat_sessions')
        .select('messages')
        .eq('id', sessionId)
        .single()

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { 
          role: 'system', 
          content: SYSTEM_PROMPT + '\n\nWhen you reference information from the provided context, include citation numbers like [1], [2], etc. to indicate which source you are referencing.'
        },
      ]

      if (session?.messages) {
        const history = (session.messages as ChatMessage[]).slice(-10)
        history.forEach(msg => {
          messages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })
        })
      }

      messages.push({ role: 'user', content: fullPrompt })

      // Generate completion
      const completion = await client.chat.completions.create({
        model: openAIConfig.models.chat,
        messages,
        temperature: openAIConfig.chat.temperature,
        max_tokens: openAIConfig.chat.maxTokens,
        top_p: openAIConfig.chat.topP,
        frequency_penalty: openAIConfig.chat.frequencyPenalty,
        presence_penalty: openAIConfig.chat.presencePenalty,
      })

      const response = completion.choices[0]?.message?.content || ''

      // Save messages with citations
      await this.saveMessage(sessionId, { role: 'user', content: userMessage })
      await this.saveMessage(sessionId, { 
        role: 'assistant', 
        content: response,
        citations: citations
      })

      return response
    } catch (error) {
      console.error('Error generating chat response:', error)
      throw new Error('Failed to generate response')
    }
  }

  /**
   * Save a message to the chat session
   */
  private async saveMessage(sessionId: string, message: ChatMessage): Promise<void> {
    const supabase = await createServiceRoleClient()

    // Get current messages
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('messages')
      .eq('id', sessionId)
      .single()

    const messages = (session?.messages as ChatMessage[]) || []
    messages.push(message)

    // Update session with new message
    await supabase
      .from('chat_sessions')
      .update({ messages })
      .eq('id', sessionId)
  }

  /**
   * Get chat history for a session
   */
  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    const supabase = await createServiceRoleClient()

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('messages')
      .eq('id', sessionId)
      .single()

    if (error) {
      throw new Error(`Failed to get chat history: ${error.message}`)
    }

    return (data?.messages as ChatMessage[]) || []
  }

  /**
   * Clear chat history for a session
   */
  async clearChatHistory(sessionId: string): Promise<void> {
    const supabase = await createServiceRoleClient()

    await supabase
      .from('chat_sessions')
      .update({ messages: [] })
      .eq('id', sessionId)
  }
}