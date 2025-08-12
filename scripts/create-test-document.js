const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Create a simple test PDF
const PDFDocument = require('pdfkit');

async function createTestDocument() {
  console.log('🚀 Creating test document setup...');
  
  // Initialize Supabase client with service role key
  const supabase = createClient(
    'http://localhost:54321',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
  );

  try {
    // 1. Create a test user
    const testUserId = '11111111-1111-1111-1111-111111111111';
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: 'test@example.com',
      password: 'testpassword123',
      email_confirm: true,
      user_metadata: {
        full_name: 'Test User'
      }
    });

    const userId = authUser?.user?.id || testUserId;
    console.log('✅ Test user ready:', userId);

    // 2. Create a simple PDF
    const doc = new PDFDocument();
    const pdfPath = path.join(__dirname, 'test-form.pdf');
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Add content to PDF
    doc.fontSize(20).text('Test Application Form', 50, 50);
    doc.fontSize(12);
    
    // Add form fields
    doc.text('Full Name: _______________________', 50, 120);
    doc.text('Email: _______________________', 50, 150);
    doc.text('Phone: _______________________', 50, 180);
    doc.text('Address: _______________________', 50, 210);
    doc.text('City: _______________________', 50, 240);
    doc.text('State: _______________________', 50, 270);
    doc.text('Zip Code: _______________________', 50, 300);
    
    doc.text('Please sign here: _______________________', 50, 350);
    doc.text('Date: _______________________', 50, 380);
    
    doc.end();

    await new Promise(resolve => stream.on('finish', resolve));
    console.log('✅ PDF created:', pdfPath);

    // 3. Upload to Supabase storage
    const fileBuffer = fs.readFileSync(pdfPath);
    const fileName = `${userId}/test-form-${Date.now()}.pdf`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      // Try creating the bucket first
      await supabase.storage.createBucket('documents', { public: false });
      // Retry upload
      const { data: retryData, error: retryError } = await supabase.storage
        .from('documents')
        .upload(fileName, fileBuffer, {
          contentType: 'application/pdf',
          upsert: true
        });
      if (retryError) throw retryError;
    }

    console.log('✅ File uploaded to storage:', fileName);

    // 4. Create document record in database
    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        filename: 'test-form.pdf',
        file_url: fileName,
        file_size: fileBuffer.length,
        mime_type: 'application/pdf',
        status: 'pending',
        metadata: {
          test: true,
          created_by: 'setup_script'
        }
      })
      .select()
      .single();

    if (dbError) {
      console.error('❌ Database error:', dbError);
      throw dbError;
    }

    console.log('✅ Document record created:', document.id);

    // 5. Add some test form fields
    const formFields = [
      { field_name: 'full_name', field_label: 'Full Name', field_type: 'text', page_number: 1 },
      { field_name: 'email', field_label: 'Email', field_type: 'email', page_number: 1 },
      { field_name: 'phone', field_label: 'Phone', field_type: 'tel', page_number: 1 },
      { field_name: 'address', field_label: 'Address', field_type: 'text', page_number: 1 },
      { field_name: 'city', field_label: 'City', field_type: 'text', page_number: 1 },
      { field_name: 'state', field_label: 'State', field_type: 'text', page_number: 1 },
      { field_name: 'zip_code', field_label: 'Zip Code', field_type: 'text', page_number: 1 },
      { field_name: 'signature', field_label: 'Signature', field_type: 'signature', page_number: 1 },
      { field_name: 'date', field_label: 'Date', field_type: 'date', page_number: 1 }
    ];

    for (const field of formFields) {
      const { error: fieldError } = await supabase
        .from('document_form_fields')
        .insert({
          document_id: document.id,
          ...field,
          confidence: 0.95,
          coordinates: {
            x: 150,
            y: 120 + (formFields.indexOf(field) * 30),
            width: 200,
            height: 20
          }
        });
      
      if (fieldError) console.warn('Field insert warning:', fieldError);
    }

    console.log('✅ Form fields added');

    // 6. Update processing status
    await supabase
      .from('documents')
      .update({ status: 'completed' })
      .eq('id', document.id);

    console.log('\n' + '='.repeat(50));
    console.log('🎉 TEST SETUP COMPLETE!');
    console.log('='.repeat(50));
    console.log('📄 Document ID:', document.id);
    console.log('👤 User Email: test@example.com');
    console.log('🔑 Password: testpassword123');
    console.log('🔗 View document at: http://localhost:3000/documents/' + document.id);
    console.log('='.repeat(50));
    
    // Clean up local PDF
    fs.unlinkSync(pdfPath);
    
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
createTestDocument();