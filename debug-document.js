const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugDocument(documentId) {
  console.log('\n=====================================');
  console.log('  DOCUMENT LOADING DEBUG');
  console.log('=====================================\n');
  
  // STEP 1: Verify document record exists
  console.log('📊 STEP 1: Checking Database Record');
  console.log('-------------------------------------');
  
  const { data: document, error: dbError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId || '3f2ce79c-d47c-4f43-ae08-f2702e15b90c')
    .single();
  
  if (dbError) {
    console.error('❌ Database Error:', dbError.message);
    return;
  }
  
  if (!document) {
    console.error('❌ Document not found in database');
    return;
  }
  
  console.log('✅ Document found in database:');
  console.log('   ID:', document.id);
  console.log('   Filename:', document.filename);
  console.log('   File URL/Path:', document.file_url);
  console.log('   Status:', document.status);
  console.log('   MIME Type:', document.mime_type);
  console.log('   File Size:', document.file_size, 'bytes');
  console.log('   Created:', document.created_at);
  
  // Check column names
  console.log('\n📋 Column Check:');
  console.log('   Has "status":', document.hasOwnProperty('status') ? '✅' : '❌');
  console.log('   Has "processing_status":', document.hasOwnProperty('processing_status') ? '⚠️ OLD COLUMN' : '✅ Correct');
  
  // STEP 2: Check if file exists in storage
  console.log('\n📦 STEP 2: Checking Storage');
  console.log('-------------------------------------');
  console.log('   Storage path:', document.file_url);
  
  try {
    // Try to download the file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.file_url);
    
    if (downloadError) {
      console.error('❌ Storage Error:', downloadError.message);
      console.log('\n🔍 Attempting to list files in bucket...');
      
      // List files to debug
      const pathParts = document.file_url.split('/');
      const folder = pathParts.slice(0, -1).join('/');
      
      const { data: files, error: listError } = await supabase.storage
        .from('documents')
        .list(folder, {
          limit: 10,
          offset: 0
        });
      
      if (listError) {
        console.error('   Cannot list files:', listError.message);
      } else if (files) {
        console.log('   Files in folder:', files.map(f => f.name).join(', '));
      }
    } else if (fileData) {
      console.log('✅ File exists in storage!');
      console.log('   File size:', fileData.size, 'bytes');
      console.log('   File type:', fileData.type);
      
      // STEP 3: Generate URLs for viewing
      console.log('\n🔗 STEP 3: Generating Access URLs');
      console.log('-------------------------------------');
      
      // Generate signed URL
      const { data: signedUrlData, error: signedError } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.file_url, 3600); // 1 hour
      
      if (signedError) {
        console.error('❌ Signed URL Error:', signedError.message);
      } else if (signedUrlData) {
        console.log('✅ Signed URL generated:');
        console.log('   URL:', signedUrlData.signedUrl.substring(0, 100) + '...');
        console.log('   Expires in: 1 hour');
        
        // Test if URL is accessible
        try {
          const response = await fetch(signedUrlData.signedUrl, { method: 'HEAD' });
          console.log('   URL accessibility:', response.ok ? '✅ Accessible' : '❌ Not accessible');
          console.log('   HTTP Status:', response.status);
        } catch (fetchError) {
          console.error('   URL test failed:', fetchError.message);
        }
      }
      
      // Check public URL
      const publicUrl = supabase.storage.from('documents').getPublicUrl(document.file_url);
      console.log('\n📌 Public URL (if bucket is public):');
      console.log('   URL:', publicUrl.data.publicUrl.substring(0, 100) + '...');
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
  
  // STEP 4: Display recommendations
  console.log('\n💡 RECOMMENDATIONS');
  console.log('-------------------------------------');
  
  if (document && document.file_url) {
    console.log('1. Document record exists ✅');
    console.log('2. File path is:', document.file_url);
    console.log('3. To display PDF:');
    console.log('   a) Use signed URL for private bucket');
    console.log('   b) Pass URL to react-pdf Document component');
    console.log('   c) Ensure PDF.js worker is loaded');
    console.log('\n4. Document AI is NOT needed for basic viewing');
    console.log('   - It\'s only for field detection/extraction');
    console.log('   - PDF should display without it');
  }
  
  console.log('\n=====================================\n');
}

// Get document ID from command line or use default
const docId = process.argv[2] || '3f2ce79c-d47c-4f43-ae08-f2702e15b90c';
console.log('🔍 Debugging document:', docId);

debugDocument(docId).catch(console.error);