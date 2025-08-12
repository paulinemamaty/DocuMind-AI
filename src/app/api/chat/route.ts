import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ChatService } from '@/services/chat-service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { documentId, message, sessionId } = await request.json()

    if (!documentId || !message) {
      return NextResponse.json(
        { error: 'Document ID and message are required' },
        { status: 400 }
      )
    }

    // Verify document ownership
    const { data: document } = await supabase
      .from('documents')
      .select('id')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found or access denied' },
        { status: 404 }
      )
    }

    const chatService = new ChatService()

    // Get or create session
    let chatSessionId = sessionId
    if (!chatSessionId) {
      const session = await chatService.getOrCreateSession(documentId, user.id)
      chatSessionId = session.id
    }

    // Generate response (non-streaming for this endpoint)
    const response = await chatService.generateResponse(
      chatSessionId,
      message,
      documentId
    )

    return NextResponse.json({
      response,
      sessionId: chatSessionId,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    )
  }
}