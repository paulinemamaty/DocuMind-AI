# Supabase Setup Instructions

## Prerequisites
- Supabase project created at https://app.supabase.com
- Supabase CLI installed (optional but recommended)

## Database Setup

### 1. Run Migrations

Go to your Supabase Dashboard > SQL Editor and run the following migration files in order:

1. **001_initial_schema.sql** - Creates all database tables with RLS policies
2. **002_storage_buckets.sql** - Sets up storage buckets for documents and signatures
3. **003_vector_search_functions.sql** - Creates helper functions for vector search

### 2. Enable pgvector Extension

If not already enabled by the migrations, go to Database > Extensions and enable:
- `uuid-ossp` - For UUID generation
- `vector` - For embedding storage and similarity search

### 3. Configure Authentication

In Authentication > Providers, enable:
- Email/Password authentication
- Google OAuth (optional)
- GitHub OAuth (optional)

### 4. Storage Configuration

The migrations create two storage buckets:
- `documents` - For uploaded PDF/image files (10MB limit)
- `signatures` - For signature images (2MB limit)

### 5. Environment Variables

Ensure these are set in your `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Testing the Setup

Run the development server:
```bash
npm run dev
```

The database is now ready for:
- User authentication
- Document upload and storage
- OCR data extraction storage
- Vector embeddings for AI search
- Version control and edit tracking
- Chat session management

## Troubleshooting

### If migrations fail:
1. Check that pgvector extension is available in your Supabase plan
2. Ensure you're running migrations in the correct order
3. Check the Supabase logs for detailed error messages

### If storage policies don't work:
1. Verify RLS is enabled on storage.objects table
2. Check that the bucket names match exactly
3. Ensure authentication is working correctly