import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    const { documentId, priority = 5, processorTypes = ['ocr', 'formParser'], useQueue = false } = await request.json()

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // Verify document ownership
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !document) {
      return NextResponse.json(
        { error: 'Document not found or access denied' },
        { status: 404 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (useQueue) {
      // Add to processing queue for async processing
      const response = await fetch(`${supabaseUrl}/functions/v1/queue-manager?action=add`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentId,
          priority,
          processorTypes,
          options: {
            fieldMask: 'text,entities,pages,tables,formFields',
            ocrHints: ['en-US']
          }
        })
      })

      if (!response.ok) {
        const error = await response.json()
        return NextResponse.json(
          { error: error.error || 'Failed to queue document' },
          { status: response.status }
        )
      }

      const result = await response.json()
      
      return NextResponse.json({
        message: 'Document queued for processing',
        queueId: result.queueId,
        documentId,
        processors: processorTypes
      })
    } else {
      // Process immediately using edge function
      const response = await fetch(`${supabaseUrl}/functions/v1/process-document`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentId,
          priority,
          processorTypes,
          options: {
            fieldMask: 'text,entities,pages,tables,formFields',
            ocrHints: ['en-US']
          }
        })
      })

      if (!response.ok) {
        const error = await response.json()
        return NextResponse.json(
          { error: error.error || 'Processing failed' },
          { status: response.status }
        )
      }

      const result = await response.json()

      // Trigger embeddings generation asynchronously
      fetch(`${supabaseUrl}/functions/v1/generate-embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ documentId })
      }).catch(err => console.error('Failed to trigger embeddings:', err))

      // Send webhook notification
      fetch(`${supabaseUrl}/functions/v1/webhook-handler?action=send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'document.processed',
          data: { documentId, ...result }
        })
      }).catch(err => console.error('Failed to send webhook:', err))

      return NextResponse.json({
        success: true,
        message: 'Document processed successfully',
        ...result
      })
    }
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}