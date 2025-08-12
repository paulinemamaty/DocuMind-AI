import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EmbeddingService } from '@/services/embedding-service'

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

    const { documentId } = await request.json()

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // Get document and extraction data
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select(`
        *,
        document_extractions (
          full_text
        )
      `)
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !document) {
      return NextResponse.json(
        { error: 'Document not found or access denied' },
        { status: 404 }
      )
    }

    const extraction = document.document_extractions?.[0]
    
    if (!extraction?.full_text) {
      return NextResponse.json(
        { error: 'Document has not been processed yet' },
        { status: 400 }
      )
    }

    // Generate embeddings
    const embeddingService = new EmbeddingService()
    
    await embeddingService.processDocumentEmbeddings({
      documentId: document.id,
      text: extraction.full_text,
      metadata: {
        filename: document.filename,
        mimeType: document.mime_type,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Embeddings generated successfully',
    })
  } catch (error) {
    console.error('Embeddings API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate embeddings' },
      { status: 500 }
    )
  }
}