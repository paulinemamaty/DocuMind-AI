#!/usr/bin/env node

/**
 * Supabase Setup Verification Script
 * This script checks if all necessary Supabase components are properly configured
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Load environment variables
dotenv.config({ path: '.env.local' })

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
}

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

async function verifySupabaseSetup() {
  log('\n🔍 Starting Supabase Setup Verification...\n', colors.blue)

  // 1. Check environment variables
  log('1. Checking Environment Variables...', colors.magenta)
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]

  let envVarsOk = true
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      log(`  ✅ ${envVar} is set`, colors.green)
    } else {
      log(`  ❌ ${envVar} is missing`, colors.red)
      envVarsOk = false
    }
  }

  if (!envVarsOk) {
    log('\n⚠️  Missing environment variables. Please check your .env.local file', colors.yellow)
    return
  }

  // 2. Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  // 3. Check database tables
  log('\n2. Checking Database Tables...', colors.magenta)
  const requiredTables = [
    'documents',
    'document_form_fields',
    'document_extractions',
    'document_embeddings',
    'chat_sessions',
    'chat_messages',
    'processing_queue',
    'user_profiles',
  ]

  for (const table of requiredTables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })

      if (error) {
        log(`  ❌ Table '${table}' - Error: ${error.message}`, colors.red)
      } else {
        log(`  ✅ Table '${table}' exists (${count ?? 0} rows)`, colors.green)
      }
    } catch (err) {
      log(`  ❌ Table '${table}' - Error checking table`, colors.red)
    }
  }

  // 4. Check storage buckets
  log('\n3. Checking Storage Buckets...', colors.magenta)
  
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets()
    
    if (error) {
      log(`  ❌ Error listing buckets: ${error.message}`, colors.red)
    } else {
      const documentsBucket = buckets?.find(b => b.name === 'documents')
      if (documentsBucket) {
        log(`  ✅ 'documents' bucket exists`, colors.green)
        
        // Check if bucket is public
        if (documentsBucket.public) {
          log(`    ℹ️  Bucket is PUBLIC (files accessible without auth)`, colors.yellow)
        } else {
          log(`    ℹ️  Bucket is PRIVATE (auth required for access)`, colors.blue)
        }
      } else {
        log(`  ❌ 'documents' bucket not found`, colors.red)
        log(`    Run: supabase storage create documents`, colors.yellow)
      }
    }
  } catch (err) {
    log(`  ❌ Error checking storage: ${err}`, colors.red)
  }

  // 5. Check RLS policies
  log('\n4. Checking RLS Policies...', colors.magenta)
  
  const tablesToCheck = ['documents', 'document_form_fields']
  for (const table of tablesToCheck) {
    try {
      // Try to query without auth to check if RLS is enabled
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .limit(1)
      
      if (error?.code === 'PGRST301') {
        log(`  ✅ RLS enabled for '${table}'`, colors.green)
      } else if (!error && data) {
        log(`  ⚠️  RLS might be disabled for '${table}' (service role can access all)`, colors.yellow)
      }
    } catch (err) {
      log(`  ❌ Error checking RLS for '${table}'`, colors.red)
    }
  }

  // 6. Check Edge Functions
  log('\n5. Checking Edge Functions Deployment...', colors.magenta)
  
  const edgeFunctions = [
    'process-document',
    'batch-process',
    'queue-manager',
    'webhook-handler',
    'generate-embeddings',
  ]

  for (const func of edgeFunctions) {
    try {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${func}`
      const response = await fetch(url, {
        method: 'OPTIONS',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      })
      
      if (response.status === 404) {
        log(`  ❌ Edge function '${func}' not deployed`, colors.red)
        log(`    Run: supabase functions deploy ${func}`, colors.yellow)
      } else if (response.ok || response.status === 400) {
        log(`  ✅ Edge function '${func}' is deployed`, colors.green)
      } else {
        log(`  ⚠️  Edge function '${func}' status unclear (${response.status})`, colors.yellow)
      }
    } catch (err) {
      log(`  ❌ Error checking edge function '${func}'`, colors.red)
    }
  }

  // 7. Test a simple document creation
  log('\n6. Testing Document Creation...', colors.magenta)
  
  try {
    const testDoc = {
      filename: 'test-verification.pdf',
      file_url: 'test/path.pdf',
      file_size: 1000,
      mime_type: 'application/pdf',
      user_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
      status: 'test',
    }

    const { data, error } = await supabase
      .from('documents')
      .insert(testDoc)
      .select()

    if (error) {
      log(`  ⚠️  Cannot create test document: ${error.message}`, colors.yellow)
    } else {
      log(`  ✅ Test document creation successful`, colors.green)
      
      // Clean up test document
      if (data && data[0]) {
        await supabase
          .from('documents')
          .delete()
          .eq('id', data[0].id)
      }
    }
  } catch (err) {
    log(`  ❌ Error testing document creation: ${err}`, colors.red)
  }

  // Summary
  log('\n📊 Verification Summary:', colors.blue)
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log('• Environment Variables: ' + (envVarsOk ? '✅ OK' : '❌ Issues found'), envVarsOk ? colors.green : colors.red)
  log('• Check the output above for specific issues', colors.yellow)
  log('• If edge functions are not deployed, run:', colors.yellow)
  log('  supabase functions deploy --no-verify-jwt', colors.yellow)
  log('• If storage bucket is missing, run:', colors.yellow)
  log('  supabase storage create documents', colors.yellow)
  log('\n')
}

// Run the verification
verifySupabaseSetup().catch(console.error)