-- ============================================
-- DocuMind AI - Storage Bucket Setup
-- Run this in Supabase SQL Editor
-- ============================================

-- Create the documents storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false, -- Set to private for security
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies for documents bucket
-- Allow authenticated users to upload their own files
CREATE POLICY "Users can upload own documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to view their own files
CREATE POLICY "Users can view own documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to update their own files
CREATE POLICY "Users can update own documents" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to delete their own files
CREATE POLICY "Users can delete own documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create a function to get signed URLs for documents
CREATE OR REPLACE FUNCTION get_document_url(doc_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  doc_url TEXT;
  file_path TEXT;
BEGIN
  -- Get the file path from documents table
  SELECT file_url INTO file_path
  FROM documents
  WHERE id = doc_id AND user_id = auth.uid();
  
  IF file_path IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Generate a signed URL (valid for 1 hour)
  SELECT storage.get_signed_url('documents', file_path, 3600) INTO doc_url;
  
  RETURN doc_url;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_document_url TO authenticated;

-- Verify storage bucket creation
SELECT * FROM storage.buckets WHERE id = 'documents';

-- Verify storage policies
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';