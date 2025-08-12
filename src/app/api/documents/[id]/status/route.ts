import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const documentId = params.id

    // Get document status
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, status, metadata')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Check if there are form fields (indicates processing is complete)
    const { count: fieldCount } = await supabase
      .from('document_form_fields')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', documentId)

    // Determine actual status
    let status = document.status
    if (status === 'pending' && fieldCount && fieldCount > 0) {
      status = 'completed'
    }

    return NextResponse.json({
      id: document.id,
      status: status,
      fieldCount: fieldCount || 0,
      metadata: document.metadata
    })
  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}