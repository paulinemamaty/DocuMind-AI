# DocuMind AI - Complete Setup Guide

## 🚨 Common Issues & Solutions

### Issue: PDF Not Loading / Document Not Displaying

This is typically caused by one or more of the following:

1. **Missing Database Tables**
2. **Storage Bucket Not Configured**
3. **Edge Functions Not Deployed**
4. **Missing Environment Variables**
5. **RLS Policies Not Set**

## 📋 Prerequisites

- Supabase Project (create at [supabase.com](https://supabase.com))
- Node.js 18+ installed
- Supabase CLI (optional, for edge functions)

## 🔧 Complete Setup Steps

### 1. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

Required variables:

#### Supabase
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Get these from your Supabase project settings:
- Go to Settings → API
- Copy the URL and keys

#### Google Cloud (Document AI)
```env
GCP_CREDENTIALS_BASE64=your_base64_encoded_service_account_json
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_CLOUD_PROJECT_NUMBER=your_project_number
GCP_OCR_PROCESSOR_ID=your_ocr_processor_id
# ... other processor IDs
```

**IMPORTANT**: See [GCP Credentials Setup Guide](docs/GCP_CREDENTIALS_SETUP.md) for secure credential configuration

### 2. Database Setup

Run the SQL setup scripts in your Supabase SQL Editor:

1. **Main Database Schema**:
   - Go to Supabase Dashboard → SQL Editor
   - Copy and run the entire contents of `scripts/setup-supabase.sql`
   - This creates all tables, indexes, and RLS policies

2. **Storage Configuration**:
   - Still in SQL Editor
   - Copy and run the entire contents of `scripts/setup-storage.sql`
   - This creates the documents storage bucket with proper policies

### 3. Verify Storage Bucket

1. Go to Supabase Dashboard → Storage
2. You should see a `documents` bucket
3. If not, create it manually:
   - Click "New bucket"
   - Name: `documents`
   - Public: OFF (keep it private)
   - File size limit: 50MB
   - Allowed MIME types: `application/pdf`, `image/png`, `image/jpeg`

### 4. Edge Functions (Optional - for advanced features)

If you want Document AI processing:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy edge functions
supabase functions deploy process-document --no-verify-jwt
supabase functions deploy generate-embeddings --no-verify-jwt
```

### 5. Run Setup Verification

We've created a verification script to check your setup:

```bash
# Install dependencies if not already done
npm install

# Run verification
npx tsx scripts/verify-supabase-setup.ts
```

This will check:
- ✅ Environment variables
- ✅ Database tables
- ✅ Storage buckets
- ✅ RLS policies
- ✅ Edge functions

### 6. Test the Application

```bash
# Start the development server
npm run dev

# Open http://localhost:3000
```

## 🐛 Debugging Tools

### Debug Panel in the App

1. Open any document
2. Click the yellow "Debug" button (top-right of PDF viewer)
3. Check for:
   - Storage URL status
   - File existence
   - API errors
   - Click "Test PDF API" to verify endpoint

### Console Logs

The app includes comprehensive logging:
- 🔍 Document fetch start
- 📄 Supabase responses
- ✅ Success indicators
- ❌ Detailed errors
- 🔗 URL generation

### Common Error Messages & Fixes

| Error | Cause | Solution |
|-------|-------|----------|
| "Unauthorized" | Missing auth | Check auth cookies, ensure user is logged in |
| "Document not found" | Missing DB record | Check documents table, verify document ID |
| "Storage error" | File doesn't exist | Check storage bucket, verify file was uploaded |
| "No file URL in database" | Incomplete upload | Re-upload document or check upload process |
| "Failed to generate signed URL" | Storage permissions | Run storage setup SQL again |

## 🔄 Quick Fix Scripts

### Reset Everything

If things aren't working, run these in order:

1. **Clear and recreate tables**:
```sql
-- Run in Supabase SQL Editor
-- WARNING: This will delete all data!
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
```

2. **Run setup scripts again**:
   - Run `scripts/setup-supabase.sql`
   - Run `scripts/setup-storage.sql`

3. **Restart the app**:
```bash
# Kill all Node processes
pkill -f node

# Clear Next.js cache
rm -rf .next

# Restart
npm run dev
```

## 📝 Manual Document Upload Test

To test if storage is working, manually upload a file:

1. Go to Supabase Dashboard → Storage → documents bucket
2. Create a folder with a user ID (any UUID)
3. Upload a test PDF
4. Note the path (e.g., `user-id/filename.pdf`)
5. Insert a test document record in SQL:

```sql
INSERT INTO documents (
  user_id,
  filename,
  file_url,
  file_size,
  mime_type,
  status
) VALUES (
  'your-auth-user-id',
  'test.pdf',
  'user-id/filename.pdf',
  1000,
  'application/pdf',
  'completed'
);
```

## 🆘 Still Having Issues?

1. **Check Browser Console** for specific errors
2. **Check Network Tab** for failed API calls
3. **Use Debug Panel** in the app for detailed info
4. **Run Verification Script** to identify missing components
5. **Check Supabase Logs** in Dashboard → Logs → API Logs

## 📧 Support

If you've followed all steps and still have issues:
1. Run the verification script and save output
2. Check browser console for errors
3. Include both in your issue report

---

**Note**: The app uses signed URLs for PDF access to avoid authentication issues. If PDFs still don't load, the issue is likely with storage bucket configuration or missing files.