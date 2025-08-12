import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ChatService } from '@/services/chat-service'

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()
  
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { documentId, message, sessionId } = await request.json()

    if (!documentId || !message) {
      return new Response('Document ID and message are required', { status: 400 })
    }

    // Verify document ownership
    const { data: document } = await supabase
      .from('documents')
      .select('id')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (!document) {
      return new Response('Document not found or access denied', { status: 404 })
    }

    const chatService = new ChatService()

    // Get or create session
    let chatSessionId = sessionId
    if (!chatSessionId) {
      const session = await chatService.getOrCreateSession(documentId, user.id)
      chatSessionId = session.id
    }

    // First, get the citations
    const citations = await chatService.searchSimilarChunksWithCitations(
      message,
      documentId,
      5
    )

    // Create a ReadableStream for the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send citations first
          const citationsData = `data: ${JSON.stringify({ 
            type: 'citations', 
            citations: citations.map((c, i) => ({
              id: i + 1,
              text: c.text.substring(0, 200) + '...', // Send truncated text for UI
              pageNumber: c.pageNumber,
              relevance: c.relevance
            }))
          })}\n\n`
          controller.enqueue(encoder.encode(citationsData))

          // Stream the response content
          for await (const chunk of chatService.generateStreamingResponse(
            chatSessionId,
            message,
            documentId
          )) {
            const data = `data: ${JSON.stringify({ 
              type: 'content', 
              content: chunk 
            })}\n\n`
            controller.enqueue(encoder.encode(data))
          }
          
          // Send session ID and done signal
          const finalData = `data: ${JSON.stringify({ 
            type: 'done',
            sessionId: chatSessionId, 
            done: true 
          })}\n\n`
          controller.enqueue(encoder.encode(finalData))
        } catch (error) {
          console.error('Streaming error:', error)
          const errorData = `data: ${JSON.stringify({ 
            type: 'error',
            error: 'Stream error' 
          })}\n\n`
          controller.enqueue(encoder.encode(errorData))
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Stream API error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}