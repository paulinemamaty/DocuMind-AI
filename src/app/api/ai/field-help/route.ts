import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

// Levenshtein distance for typo detection
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

// Common field patterns and examples
const FIELD_PATTERNS = {
  name: {
    commonValues: ['John', 'Jane', 'Smith', 'Johnson', 'Williams', 'Brown', 'Jones'],
    format: 'First Last',
    corrections: {
      'jhon': 'John',
      'smit': 'Smith',
      'willims': 'Williams'
    }
  },
  email: {
    commonDomains: ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'],
    format: 'username@domain.com',
    corrections: {
      'gmial': 'gmail',
      'yahooo': 'yahoo',
      'outlok': 'outlook'
    }
  },
  phone: {
    format: '(XXX) XXX-XXXX',
    areaCodesUS: ['212', '213', '214', '215', '216', '217', '218', '219', '220'],
    corrections: {}
  },
  address: {
    commonStreetTypes: ['Street', 'St', 'Avenue', 'Ave', 'Road', 'Rd', 'Boulevard', 'Blvd', 'Lane', 'Ln', 'Drive', 'Dr'],
    format: '123 Main St, City, State ZIP',
    corrections: {
      'stret': 'Street',
      'avnue': 'Avenue',
      'boulvard': 'Boulevard'
    }
  },
  city: {
    commonCities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego'],
    corrections: {
      'newyork': 'New York',
      'losangeles': 'Los Angeles',
      'sandiego': 'San Diego'
    }
  },
  state: {
    states: ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'],
    corrections: {
      'newyork': 'NY',
      'california': 'CA',
      'texas': 'TX'
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fieldName, fieldLabel, fieldType, currentValue } = await request.json()

    // Detect field category
    const fieldCategory = detectFieldCategory(fieldName, fieldLabel)
    const pattern = FIELD_PATTERNS[fieldCategory as keyof typeof FIELD_PATTERNS]

    // Check for typos and suggest corrections
    let correction = null
    if (currentValue && pattern && 'corrections' in pattern && pattern.corrections) {
      const lowerValue = currentValue.toLowerCase()
      const corrections = pattern.corrections as Record<string, string>
      
      // Direct correction lookup
      if (corrections[lowerValue]) {
        correction = corrections[lowerValue]
      } else {
        // Use Levenshtein distance for fuzzy matching
        for (const [typo, correct] of Object.entries(corrections)) {
          if (levenshteinDistance(lowerValue, typo) <= 2) {
            correction = correct
            break
          }
        }
      }
    }

    // Generate contextual help
    const prompt = `
      You are a helpful form assistant. Provide brief, clear guidance for filling out this form field:
      
      Field Name: ${fieldName}
      Field Label: ${fieldLabel}
      Field Type: ${fieldType}
      Current Value: ${currentValue || 'empty'}
      
      Provide:
      1. A brief suggestion on what to enter (1 sentence)
      2. If the current value seems incorrect, suggest a correction
      3. Any important notes about this field type
      
      Keep response under 50 words total. Be helpful but concise.
    `

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.3
    })

    const aiResponse = completion.choices[0].message.content || ''

    // Parse response or use fallback
    let suggestion = aiResponse
    
    // Add pattern-based suggestions if AI doesn't provide
    if (!suggestion && pattern) {
      suggestion = `Enter a valid ${fieldCategory}. ${pattern && 'format' in pattern && pattern.format ? `Format: ${pattern.format}` : ''}`
    }

    // Get previous user values for this field type (for learning)
    const { data: previousEntries } = await supabase
      .from('document_filled_data')
      .select('value')
      .eq('user_id', user.id)
      .ilike('field_id', `%${fieldCategory}%`)
      .limit(5)

    const previousValues = previousEntries?.map((e: any) => e.value) || []

    return NextResponse.json({
      suggestion,
      correction,
      previousValues,
      format: pattern && 'format' in pattern ? pattern.format : undefined,
      examples: getExamplesForField(fieldCategory)
    })

  } catch (error) {
    console.error('Field help error:', error)
    return NextResponse.json(
      { error: 'Failed to get field help' },
      { status: 500 }
    )
  }
}

function detectFieldCategory(fieldName: string, fieldLabel: string): string {
  const combined = `${fieldName} ${fieldLabel}`.toLowerCase()
  
  if (combined.includes('email')) return 'email'
  if (combined.includes('phone') || combined.includes('tel')) return 'phone'
  if (combined.includes('address') || combined.includes('street')) return 'address'
  if (combined.includes('city')) return 'city'
  if (combined.includes('state')) return 'state'
  if (combined.includes('name') && !combined.includes('company')) return 'name'
  
  return 'text'
}

function getExamplesForField(fieldCategory: string): string[] {
  switch (fieldCategory) {
    case 'email':
      return ['john.doe@gmail.com', 'jane.smith@company.com']
    case 'phone':
      return ['(555) 123-4567', '555-123-4567']
    case 'address':
      return ['123 Main St, Apt 4B', '456 Oak Avenue']
    case 'city':
      return ['New York', 'Los Angeles']
    case 'state':
      return ['NY', 'CA']
    case 'name':
      return ['John Smith', 'Jane Doe']
    default:
      return []
  }
}