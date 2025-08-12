import { createClient } from '@/lib/supabase/client'
import { FieldType, type EnhancedFormField } from './enhanced-form-detector'

export interface AutoFillSuggestion {
  value: string
  confidence: number
  source: 'profile' | 'history' | 'pattern' | 'similar'
  description?: string
}

export class AutoFillService {
  private supabase = createClient()
  private userId: string | null = null
  private userProfile: Record<string, any> = {}
  private fieldHistory: Map<string, string[]> = new Map()
  private commonPatterns: Map<string, RegExp> = new Map()

  constructor() {
    this.initializePatterns()
    this.loadUserData()
  }

  // Initialize common format patterns
  private initializePatterns() {
    this.commonPatterns.set('phone', /^\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})$/)
    this.commonPatterns.set('ssn', /^(\d{3})-?(\d{2})-?(\d{4})$/)
    this.commonPatterns.set('zip', /^(\d{5})(-\d{4})?$/)
    this.commonPatterns.set('email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    this.commonPatterns.set('date', /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  }

  // Load user profile and history
  private async loadUserData() {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (user) {
      this.userId = user.id
      await this.loadUserProfile()
      await this.loadFieldHistory()
    }
  }

  // Load user profile data
  private async loadUserProfile() {
    if (!this.userId) return

    const { data } = await this.supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', this.userId)
      .single()

    if (data) {
      this.userProfile = data
    }
  }

  // Load field history
  private async loadFieldHistory() {
    if (!this.userId) return

    const { data } = await this.supabase
      .from('form_field_history')
      .select('field_type, field_value')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (data) {
      data.forEach(entry => {
        const key = entry.field_type
        if (!this.fieldHistory.has(key)) {
          this.fieldHistory.set(key, [])
        }
        const values = this.fieldHistory.get(key)!
        if (!values.includes(entry.field_value)) {
          values.push(entry.field_value)
        }
      })
    }
  }

  // Get suggestions for a field
  async getSuggestions(field: EnhancedFormField): Promise<AutoFillSuggestion[]> {
    const suggestions: AutoFillSuggestion[] = []

    // 1. Check user profile for matching data
    const profileSuggestion = this.getProfileSuggestion(field)
    if (profileSuggestion) {
      suggestions.push(profileSuggestion)
    }

    // 2. Check field history
    const historySuggestions = this.getHistorySuggestions(field)
    suggestions.push(...historySuggestions)

    // 3. Generate pattern-based suggestions
    const patternSuggestion = this.getPatternSuggestion(field)
    if (patternSuggestion) {
      suggestions.push(patternSuggestion)
    }

    // 4. Get context-based suggestions
    const contextSuggestions = await this.getContextSuggestions(field)
    suggestions.push(...contextSuggestions)

    // Sort by confidence and deduplicate
    return this.deduplicateAndSort(suggestions)
  }

  // Get suggestion from user profile
  private getProfileSuggestion(field: EnhancedFormField): AutoFillSuggestion | null {
    const fieldMap: Record<string, string[]> = {
      [FieldType.EMAIL]: ['email', 'contact_email'],
      [FieldType.PHONE]: ['phone', 'mobile', 'contact_phone'],
      [FieldType.ADDRESS]: ['address', 'street_address'],
      'first_name': ['first_name', 'fname'],
      'last_name': ['last_name', 'lname'],
      'full_name': ['full_name', 'name'],
      'city': ['city'],
      'state': ['state'],
      'zip': ['zip_code', 'postal_code'],
    }

    const possibleKeys = fieldMap[field.field_type] || fieldMap[field.field_name.toLowerCase()] || []
    
    for (const key of possibleKeys) {
      if (this.userProfile[key]) {
        return {
          value: this.userProfile[key],
          confidence: 0.95,
          source: 'profile',
          description: 'From your profile'
        }
      }
    }

    return null
  }

  // Get suggestions from history
  private getHistorySuggestions(field: EnhancedFormField): AutoFillSuggestion[] {
    const suggestions: AutoFillSuggestion[] = []
    const history = this.fieldHistory.get(field.field_type) || []

    history.slice(0, 3).forEach((value, index) => {
      suggestions.push({
        value,
        confidence: 0.8 - (index * 0.1),
        source: 'history',
        description: 'Previously used'
      })
    })

    return suggestions
  }

  // Get pattern-based suggestion
  private getPatternSuggestion(field: EnhancedFormField): AutoFillSuggestion | null {
    // Provide format examples for certain field types
    const examples: Record<FieldType, string> = {
      [FieldType.PHONE]: '(555) 123-4567',
      [FieldType.SSN]: '123-45-6789',
      [FieldType.ZIP]: '12345',
      [FieldType.DATE]: '01/01/2024',
      [FieldType.EMAIL]: 'example@email.com',
      [FieldType.CURRENCY]: '$0.00',
      [FieldType.NUMBER]: '0',
      [FieldType.TEXT]: '',
      [FieldType.ADDRESS]: '',
      [FieldType.CHECKBOX]: '',
      [FieldType.RADIO]: '',
      [FieldType.SIGNATURE]: '',
      [FieldType.SELECT]: '',
      [FieldType.TEXTAREA]: ''
    }

    const example = examples[field.field_type]
    if (example) {
      return {
        value: example,
        confidence: 0.3,
        source: 'pattern',
        description: 'Format example'
      }
    }

    return null
  }

  // Get context-based suggestions
  private async getContextSuggestions(field: EnhancedFormField): Promise<AutoFillSuggestion[]> {
    const suggestions: AutoFillSuggestion[] = []

    // Check for similar fields in the same document
    if (field.group) {
      const { data: similarFields } = await this.supabase
        .from('document_filled_data')
        .select('field_value')
        .eq('field_group', field.group)
        .eq('user_id', this.userId)
        .limit(3)

      if (similarFields) {
        similarFields.forEach(item => {
          suggestions.push({
            value: item.field_value,
            confidence: 0.6,
            source: 'similar',
            description: 'From similar field'
          })
        })
      }
    }

    return suggestions
  }

  // Auto-format input value
  autoFormat(value: string, fieldType: FieldType): string {
    switch (fieldType) {
      case FieldType.PHONE:
        return this.formatPhone(value)
      case FieldType.SSN:
        return this.formatSSN(value)
      case FieldType.DATE:
        return this.formatDate(value)
      case FieldType.ZIP:
        return this.formatZip(value)
      case FieldType.CURRENCY:
        return this.formatCurrency(value)
      default:
        return value
    }
  }

  // Format phone number
  private formatPhone(value: string): string {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`
  }

  // Format SSN
  private formatSSN(value: string): string {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 5) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5, 9)}`
  }

  // Format date
  private formatDate(value: string): string {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`
  }

  // Format ZIP code
  private formatZip(value: string): string {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 5) return numbers
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 9)}`
  }

  // Format currency
  private formatCurrency(value: string): string {
    const numbers = value.replace(/[^\d.]/g, '')
    const parts = numbers.split('.')
    const dollars = parts[0] || '0'
    const cents = (parts[1] || '00').slice(0, 2).padEnd(2, '0')
    return `$${parseInt(dollars).toLocaleString()}.${cents}`
  }

  // Copy fields from source to target (e.g., billing to shipping)
  async copyFields(sourceGroup: string, targetGroup: string, fields: EnhancedFormField[]): Promise<Record<string, string>> {
    const copiedValues: Record<string, string> = {}

    // Get source field values
    const sourceFields = fields.filter(f => f.group === sourceGroup)
    const targetFields = fields.filter(f => f.group === targetGroup)

    for (const targetField of targetFields) {
      // Find matching source field by type or name similarity
      const sourceField = sourceFields.find(sf => 
        sf.field_type === targetField.field_type ||
        this.calculateSimilarity(sf.field_name, targetField.field_name) > 0.7
      )

      if (sourceField && sourceField.field_value) {
        copiedValues[targetField.id] = sourceField.field_value
      }
    }

    return copiedValues
  }

  // Calculate string similarity
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase()
    const s2 = str2.toLowerCase()
    
    if (s1 === s2) return 1
    
    const longer = s1.length > s2.length ? s1 : s2
    const shorter = s1.length > s2.length ? s2 : s1
    
    if (longer.length === 0) return 1
    
    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  // Levenshtein distance calculation
  private levenshteinDistance(s1: string, s2: string): number {
    const costs: number[] = []
    for (let i = 0; i <= s2.length; i++) {
      let lastValue = i
      for (let j = 0; j <= s1.length; j++) {
        if (i === 0) {
          costs[j] = j
        } else if (j > 0) {
          let newValue = costs[j - 1]
          if (s1.charAt(j - 1) !== s2.charAt(i - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
          }
          costs[j - 1] = lastValue
          lastValue = newValue
        }
      }
      if (i > 0) costs[s1.length] = lastValue
    }
    return costs[s1.length]
  }

  // Save field value to history
  async saveFieldValue(field: EnhancedFormField, value: string) {
    if (!this.userId || !value) return

    await this.supabase
      .from('form_field_history')
      .insert({
        user_id: this.userId,
        field_type: field.field_type,
        field_name: field.field_name,
        field_value: value,
        document_id: field.document_id
      })

    // Update local cache
    if (!this.fieldHistory.has(field.field_type)) {
      this.fieldHistory.set(field.field_type, [])
    }
    const values = this.fieldHistory.get(field.field_type)!
    if (!values.includes(value)) {
      values.unshift(value)
      if (values.length > 10) values.pop()
    }
  }

  // Deduplicate and sort suggestions
  private deduplicateAndSort(suggestions: AutoFillSuggestion[]): AutoFillSuggestion[] {
    const seen = new Set<string>()
    const unique = suggestions.filter(s => {
      if (seen.has(s.value)) return false
      seen.add(s.value)
      return true
    })

    return unique.sort((a, b) => b.confidence - a.confidence).slice(0, 5)
  }
}