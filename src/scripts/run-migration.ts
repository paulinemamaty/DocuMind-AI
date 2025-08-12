import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function runMigration() {
  try {
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/005_document_filled_data.sql')
    const migration = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('Running migration: 005_document_filled_data.sql')
    
    const { error } = await supabase.rpc('exec_sql', {
      sql: migration
    })
    
    if (error) {
      console.error('Migration error:', error)
      // Try running the migration as individual statements
      const statements = migration.split(';').filter(s => s.trim())
      for (const statement of statements) {
        if (statement.trim()) {
          console.log('Running statement:', statement.substring(0, 50) + '...')
          try {
            await supabase.rpc('exec_sql', { sql: statement + ';' })
          } catch (e) {
            console.error('Statement error:', e)
          }
        }
      }
    } else {
      console.log('Migration completed successfully!')
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

runMigration()