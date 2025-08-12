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

    const { 
      documentIds, 
      priority = 5, 
      processorTypes = ['ocr', 'formParser'],
      maxConcurrency = 5 
    } = await request.json()

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'Document IDs array is required' },
        { status: 400 }
      )
    }

    if (documentIds.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 documents per batch' },
        { status: 400 }
      )
    }

    // Verify document ownership for all documents
    const { data: documents, error: fetchError } = await supabase
      .from('documents')
      .select('id')
      .in('id', documentIds)
      .eq('user_id', user.id)

    if (fetchError || !documents || documents.length !== documentIds.length) {
      return NextResponse.json(
        { error: 'Some documents not found or access denied' },
        { status: 404 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Call batch processing edge function
    const response = await fetch(`${supabaseUrl}/functions/v1/batch-process`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        documentIds,
        priority,
        processorTypes,
        options: {
          maxConcurrency,
          fieldMask: 'text,entities,pages,tables,formFields',
          ocrHints: ['en-US']
        }
      })
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.error || 'Batch processing failed' },
        { status: response.status }
      )
    }

    const result = await response.json()

    // Send webhook notification for batch completion
    fetch(`${supabaseUrl}/functions/v1/webhook-handler?action=send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'batch.completed',
        data: {
          userId: user.id,
          ...result
        }
      })
    }).catch(err => console.error('Failed to send webhook:', err))

    return NextResponse.json({
      success: true,
      message: 'Batch processing completed',
      ...result
    })

  } catch (error) {
    console.error('Batch processing API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}