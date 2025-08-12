#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('');
console.log('===========================================');
console.log('   Google Cloud Credentials Setup Helper');
console.log('===========================================');
console.log('');
console.log('This tool will help you convert your service account key');
console.log('to base64 and add it to your .env.local file.');
console.log('');

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  try {
    // Step 1: Get the path to the service account key
    console.log('Step 1: Locate your service account key JSON file');
    console.log('-----------------------------------------------');
    console.log('If you don\'t have one yet:');
    console.log('1. Go to https://console.cloud.google.com');
    console.log('2. Navigate to "IAM & Admin" → "Service Accounts"');
    console.log('3. Create or select a service account');
    console.log('4. Click "Keys" → "Add Key" → "Create new key" → JSON');
    console.log('');
    
    const keyPath = await question('Enter the path to your service account JSON file (or drag & drop it here): ');
    const cleanPath = keyPath.trim().replace(/^['"]|['"]$/g, ''); // Remove quotes if dragged
    
    // Check if file exists
    if (!fs.existsSync(cleanPath)) {
      console.error('\n❌ File not found:', cleanPath);
      console.log('\nPlease make sure the file path is correct.');
      process.exit(1);
    }
    
    // Step 2: Read and validate the JSON
    console.log('\n✅ File found! Reading...');
    const jsonContent = fs.readFileSync(cleanPath, 'utf8');
    
    try {
      JSON.parse(jsonContent); // Validate it's valid JSON
      console.log('✅ Valid JSON file');
    } catch (e) {
      console.error('\n❌ Invalid JSON file. Please make sure this is a valid service account key.');
      process.exit(1);
    }
    
    // Step 3: Convert to base64
    console.log('\nStep 2: Converting to base64...');
    console.log('--------------------------------');
    const base64String = Buffer.from(jsonContent).toString('base64');
    console.log('✅ Converted to base64 successfully');
    
    // Step 4: Update .env.local
    console.log('\nStep 3: Updating .env.local file...');
    console.log('------------------------------------');
    
    const envPath = path.join(__dirname, '.env.local');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      
      // Check if GCP_CREDENTIALS_BASE64 already exists
      if (envContent.includes('GCP_CREDENTIALS_BASE64=')) {
        console.log('⚠️  GCP_CREDENTIALS_BASE64 already exists in .env.local');
        const overwrite = await question('Do you want to replace it? (yes/no): ');
        
        if (overwrite.toLowerCase() !== 'yes' && overwrite.toLowerCase() !== 'y') {
          console.log('\n📋 Here is your base64 string to add manually:');
          console.log('GCP_CREDENTIALS_BASE64=' + base64String);
          process.exit(0);
        }
        
        // Replace existing
        envContent = envContent.replace(
          /GCP_CREDENTIALS_BASE64=.*/,
          `GCP_CREDENTIALS_BASE64=${base64String}`
        );
      } else {
        // Add new
        envContent += `\n# Google Cloud Service Account (base64 encoded)\nGCP_CREDENTIALS_BASE64=${base64String}\n`;
      }
    } else {
      // Create new .env.local
      envContent = `# Google Cloud Service Account (base64 encoded)\nGCP_CREDENTIALS_BASE64=${base64String}\n`;
    }
    
    // Write the file
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Updated .env.local file');
    
    // Step 5: Offer to delete the original JSON file
    console.log('\nStep 4: Security Cleanup');
    console.log('------------------------');
    console.log('⚠️  IMPORTANT: You should delete the original JSON file for security.');
    console.log('   It should never be committed to Git!');
    
    const deleteFile = await question(`\nDelete ${cleanPath}? (yes/no): `);
    
    if (deleteFile.toLowerCase() === 'yes' || deleteFile.toLowerCase() === 'y') {
      fs.unlinkSync(cleanPath);
      console.log('✅ Original JSON file deleted');
    } else {
      console.log('\n⚠️  Remember to:');
      console.log('   1. Delete the JSON file manually');
      console.log('   2. NEVER commit it to Git');
      console.log('   3. Add it to .gitignore if not already there');
    }
    
    console.log('\n===========================================');
    console.log('            Setup Complete! 🎉');
    console.log('===========================================');
    console.log('\n✅ Your credentials are now configured.');
    console.log('✅ You can start the app with: npm run dev');
    console.log('\nIf you need to see your other Google Cloud settings,');
    console.log('check .env.local.example for the required processor IDs.');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();