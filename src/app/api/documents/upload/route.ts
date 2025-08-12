import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
  'image/gif',
  'image/bmp',
  'image/webp',
]

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

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Supported: PDF, PNG, JPEG, TIFF, GIF, BMP, WEBP' },
        { status: 400 }
      )
    }

    // Generate unique file path
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Create document record in database
    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        filename: file.name,
        file_url: fileName,
        file_size: file.size,
        mime_type: file.type,
        status: 'pending',
        metadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
        }
      })
      .select()
      .single()

    if (dbError) {
      // Cleanup uploaded file if database insert fails
      await supabase.storage.from('documents').remove([fileName])
      
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Failed to save document record' },
        { status: 500 }
      )
    }

    // Trigger field detection automatically after upload
    try {
      // Use internal API call to detect fields
      const baseUrl = request.nextUrl.origin
      const detectResponse = await fetch(`${baseUrl}/api/documents/detect-fields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Forward auth cookie for internal API call
          'Cookie': request.headers.get('cookie') || ''
        },
        body: JSON.stringify({ documentId: document.id })
      })

      if (detectResponse.ok) {
        const detectResult = await detectResponse.json()
        console.log('Field detection triggered:', detectResult.message)
      } else {
        console.warn('Field detection failed, document uploaded without fields')
      }
    } catch (detectError) {
      console.error('Failed to trigger field detection:', detectError)
      // Don't fail the upload if detection fails
    }

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        filename: document.filename,
        status: document.status,
        createdAt: document.created_at,
      },
      message: 'Document uploaded successfully. Processing started.',
    })
  } catch (error) {
    console.error('Upload API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}