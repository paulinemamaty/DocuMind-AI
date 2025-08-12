import { createClient } from '@/lib/supabase/client'

// Field type patterns for intelligent recognition
export const FIELD_PATTERNS = {
  // Personal Information
  firstName: /^(first[_\s-]?name|fname|given[_\s-]?name)$/i,
  lastName: /^(last[_\s-]?name|lname|surname|family[_\s-]?name)$/i,
  middleName: /^(middle[_\s-]?name|mname|middle[_\s-]?initial|mi)$/i,
  fullName: /^(full[_\s-]?name|name|applicant[_\s-]?name|your[_\s-]?name)$/i,
  dateOfBirth: /^(date[_\s-]?of[_\s-]?birth|dob|birth[_\s-]?date|birthday)$/i,
  
  // Contact Information
  email: /^(email|e[_\s-]?mail|email[_\s-]?address|contact[_\s-]?email)$/i,
  phone: /^(phone|telephone|tel|mobile|cell|contact[_\s-]?number|phone[_\s-]?number)$/i,
  fax: /^(fax|facsimile|fax[_\s-]?number)$/i,
  
  // Address Fields
  streetAddress: /^(street|address|street[_\s-]?address|address[_\s-]?1|line[_\s-]?1)$/i,
  addressLine2: /^(address[_\s-]?2|line[_\s-]?2|apt|apartment|unit|suite)$/i,
  city: /^(city|town|municipality)$/i,
  state: /^(state|province|region)$/i,
  zipCode: /^(zip|postal[_\s-]?code|postcode|zip[_\s-]?code)$/i,
  country: /^(country|nation)$/i,
  
  // Identification
  ssn: /^(ssn|social[_\s-]?security|social[_\s-]?security[_\s-]?number|tin)$/i,
  driversLicense: /^(driver[_\s-]?license|dl|license[_\s-]?number|driver[_\s-]?id)$/i,
  passport: /^(passport|passport[_\s-]?number|passport[_\s-]?no)$/i,
  ein: /^(ein|employer[_\s-]?id|employer[_\s-]?identification|federal[_\s-]?tax[_\s-]?id)$/i,
  
  // Employment
  employer: /^(employer|company|organization|employer[_\s-]?name|company[_\s-]?name)$/i,
  jobTitle: /^(job[_\s-]?title|position|title|occupation|role)$/i,
  salary: /^(salary|income|wages|compensation|annual[_\s-]?income)$/i,
  startDate: /^(start[_\s-]?date|hire[_\s-]?date|employment[_\s-]?date|from[_\s-]?date)$/i,
  endDate: /^(end[_\s-]?date|termination[_\s-]?date|to[_\s-]?date|until)$/i,
  
  // Financial
  accountNumber: /^(account[_\s-]?number|account[_\s-]?no|acct)$/i,
  routingNumber: /^(routing[_\s-]?number|routing|aba|bank[_\s-]?routing)$/i,
  creditCard: /^(credit[_\s-]?card|card[_\s-]?number|cc)$/i,
  
  // Signatures and Dates
  signature: /^(signature|sign|signed[_\s-]?by|applicant[_\s-]?signature)$/i,
  date: /^(date|dated|current[_\s-]?date|today|submission[_\s-]?date)$/i,
  
  // Checkboxes and Options
  checkbox: /^(check|checkbox|option|select|choice|yes[_\s-]?no)$/i,
  radioButton: /^(radio|option|choice|select[_\s-]?one)$/i,
}

// Field type detection based on patterns
export enum FieldType {
  TEXT = 'text',
  EMAIL = 'email',
  PHONE = 'phone',
  DATE = 'date',
  SSN = 'ssn',
  ZIP = 'zip',
  NUMBER = 'number',
  CURRENCY = 'currency',
  CHECKBOX = 'checkbox',
  RADIO = 'radio',
  SIGNATURE = 'signature',
  ADDRESS = 'address',
  SELECT = 'select',
  TEXTAREA = 'textarea'
}

// Field icons for visual representation
export const FIELD_ICONS: Record<FieldType, string> = {
  [FieldType.TEXT]: '📝',
  [FieldType.EMAIL]: '📧',
  [FieldType.PHONE]: '📞',
  [FieldType.DATE]: '📅',
  [FieldType.SSN]: '🔐',
  [FieldType.ZIP]: '📍',
  [FieldType.NUMBER]: '🔢',
  [FieldType.CURRENCY]: '💵',
  [FieldType.CHECKBOX]: '☑️',
  [FieldType.RADIO]: '⭕',
  [FieldType.SIGNATURE]: '✍️',
  [FieldType.ADDRESS]: '🏠',
  [FieldType.SELECT]: '📋',
  [FieldType.TEXTAREA]: '📄'
}

export interface EnhancedFormField {
  id: string
  field_name: string
  field_label: string
  field_type: FieldType
  field_value?: string
  confidence: number
  required: boolean
  validation_pattern?: string
  placeholder?: string
  help_text?: string
  icon: string
  group?: string
  page_number?: number
  document_id?: string
  coordinates?: {
    x: number
    y: number
    width: number
    height: number
    page: number
  }
  related_fields?: string[]
  auto_complete_suggestions?: string[]
  validation_rules?: {
    min_length?: number
    max_length?: number
    pattern?: string
    custom?: string
  }
}

export interface FieldGroup {
  name: string
  fields: EnhancedFormField[]
  icon: string
  completion_percentage: number
}

export class EnhancedFormDetector {
  private static instance: EnhancedFormDetector
  
  private constructor() {}
  
  static getInstance(): EnhancedFormDetector {
    if (!this.instance) {
      this.instance = new EnhancedFormDetector()
    }
    return this.instance
  }

  // Enhanced field type detection with improved confidence scoring
  detectFieldType(fieldName: string, fieldLabel: string = '', context?: string): { type: FieldType; confidence: number } {
    const combinedText = `${fieldName} ${fieldLabel} ${context || ''}`.toLowerCase()
    let maxConfidence = 0
    let detectedType = FieldType.TEXT
    
    // Score each pattern match
    const patternScores: Array<{ pattern: RegExp; type: FieldType; weight: number }> = [
      { pattern: FIELD_PATTERNS.email, type: FieldType.EMAIL, weight: 1.0 },
      { pattern: FIELD_PATTERNS.phone, type: FieldType.PHONE, weight: 1.0 },
      { pattern: FIELD_PATTERNS.ssn, type: FieldType.SSN, weight: 0.95 },
      { pattern: FIELD_PATTERNS.signature, type: FieldType.SIGNATURE, weight: 1.0 },
      { pattern: FIELD_PATTERNS.dateOfBirth, type: FieldType.DATE, weight: 0.9 },
      { pattern: FIELD_PATTERNS.zipCode, type: FieldType.ZIP, weight: 0.9 },
      { pattern: FIELD_PATTERNS.streetAddress, type: FieldType.ADDRESS, weight: 0.9 },
      { pattern: FIELD_PATTERNS.checkbox, type: FieldType.CHECKBOX, weight: 0.85 },
    ]
    
    // Check exact pattern matches first
    for (const { pattern, type, weight } of patternScores) {
      if (pattern.test(fieldName)) {
        const confidence = weight * 0.95 // High confidence for exact matches
        if (confidence > maxConfidence) {
          maxConfidence = confidence
          detectedType = type
        }
      }
    }
    
    // Check contextual matches with lower confidence
    const contextualMatches: Array<{ keywords: string[]; type: FieldType; weight: number }> = [
      { keywords: ['email', 'e-mail', '@'], type: FieldType.EMAIL, weight: 0.9 },
      { keywords: ['phone', 'telephone', 'mobile', 'cell'], type: FieldType.PHONE, weight: 0.9 },
      { keywords: ['social', 'ssn', 'security'], type: FieldType.SSN, weight: 0.85 },
      { keywords: ['date', 'birth', 'dob', 'birthday'], type: FieldType.DATE, weight: 0.8 },
      { keywords: ['zip', 'postal', 'postcode'], type: FieldType.ZIP, weight: 0.85 },
      { keywords: ['address', 'street', 'location'], type: FieldType.ADDRESS, weight: 0.8 },
      { keywords: ['amount', 'price', 'salary', 'income', '$', 'dollar'], type: FieldType.CURRENCY, weight: 0.8 },
      { keywords: ['number', 'count', 'quantity', '#'], type: FieldType.NUMBER, weight: 0.7 },
      { keywords: ['sign', 'signature', 'signed'], type: FieldType.SIGNATURE, weight: 0.9 },
      { keywords: ['check', 'checkbox', 'tick'], type: FieldType.CHECKBOX, weight: 0.75 },
    ]
    
    for (const { keywords, type, weight } of contextualMatches) {
      const matchCount = keywords.filter(keyword => combinedText.includes(keyword)).length
      if (matchCount > 0) {
        const confidence = weight * (matchCount / keywords.length) * 0.8 // Medium confidence for contextual
        if (confidence > maxConfidence) {
          maxConfidence = confidence
          detectedType = type
        }
      }
    }
    
    // Apply confidence boosts based on additional context
    if (maxConfidence > 0) {
      // Boost confidence if field name is descriptive
      if (fieldName.length > 3) maxConfidence = Math.min(1.0, maxConfidence + 0.05)
      
      // Boost confidence if we have both field name and label
      if (fieldName && fieldLabel && fieldName !== fieldLabel) {
        maxConfidence = Math.min(1.0, maxConfidence + 0.1)
      }
      
      // Reduce confidence for generic names
      const genericNames = ['field', 'input', 'text', 'data', 'value', 'item']
      if (genericNames.some(name => fieldName.toLowerCase().includes(name))) {
        maxConfidence *= 0.7
      }
    }
    
    return { 
      type: maxConfidence > 0.5 ? detectedType : FieldType.TEXT, 
      confidence: Math.max(0.3, maxConfidence) // Minimum confidence of 0.3
    }
  }

  // Group related fields together
  groupFields(fields: EnhancedFormField[]): FieldGroup[] {
    const groups: Map<string, EnhancedFormField[]> = new Map()
    
    fields.forEach(field => {
      let groupName = 'General Information'
      
      const fieldNameLower = field.field_name.toLowerCase()
      const fieldLabelLower = field.field_label.toLowerCase()
      
      // Determine group based on field type and name
      if (fieldNameLower.includes('name') || fieldLabelLower.includes('name')) {
        groupName = 'Personal Information'
      } else if (fieldNameLower.includes('address') || fieldNameLower.includes('city') || 
                 fieldNameLower.includes('state') || fieldNameLower.includes('zip')) {
        groupName = 'Address Information'
      } else if (fieldNameLower.includes('phone') || fieldNameLower.includes('email') || 
                 fieldNameLower.includes('fax')) {
        groupName = 'Contact Information'
      } else if (fieldNameLower.includes('employer') || fieldNameLower.includes('job') || 
                 fieldNameLower.includes('salary')) {
        groupName = 'Employment Information'
      } else if (fieldNameLower.includes('ssn') || fieldNameLower.includes('license') || 
                 fieldNameLower.includes('passport')) {
        groupName = 'Identification'
      } else if (fieldNameLower.includes('account') || fieldNameLower.includes('routing') || 
                 fieldNameLower.includes('bank')) {
        groupName = 'Financial Information'
      } else if (fieldNameLower.includes('signature') || fieldNameLower.includes('date')) {
        groupName = 'Certification'
      }
      
      if (!groups.has(groupName)) {
        groups.set(groupName, [])
      }
      groups.get(groupName)!.push(field)
    })
    
    // Convert to FieldGroup array
    const fieldGroups: FieldGroup[] = []
    groups.forEach((fields, name) => {
      const filledFields = fields.filter(f => f.field_value && f.field_value.trim() !== '').length
      const completionPercentage = fields.length > 0 ? (filledFields / fields.length) * 100 : 0
      
      fieldGroups.push({
        name,
        fields,
        icon: this.getGroupIcon(name),
        completion_percentage: completionPercentage
      })
    })
    
    return fieldGroups
  }

  // Get icon for field group
  private getGroupIcon(groupName: string): string {
    const icons: Record<string, string> = {
      'Personal Information': '👤',
      'Address Information': '🏠',
      'Contact Information': '📞',
      'Employment Information': '💼',
      'Identification': '🆔',
      'Financial Information': '💳',
      'Certification': '✍️',
      'General Information': '📋'
    }
    return icons[groupName] || '📋'
  }

  // Enhance form fields with intelligent detection
  async enhanceFormFields(
    documentId: string,
    rawFields: any[]
  ): Promise<EnhancedFormField[]> {
    const enhancedFields: EnhancedFormField[] = []
    
    for (const field of rawFields) {
      const { type, confidence } = this.detectFieldType(field.field_name || '', field.field_label || '')
      
      const enhancedField: EnhancedFormField = {
        id: field.id || `field_${Date.now()}_${Math.random()}`,
        field_name: field.field_name || '',
        field_label: field.field_label || field.field_name || '',
        field_type: type,
        field_value: field.field_value || '',
        confidence: Math.min(confidence, field.confidence || 0.5),
        required: this.isFieldRequired(field.field_label || field.field_name || ''),
        icon: FIELD_ICONS[type],
        placeholder: this.getPlaceholder(type, field.field_name || ''),
        help_text: this.getHelpText(type, field.field_name || ''),
        validation_pattern: this.getValidationPattern(type),
        coordinates: field.coordinates,
        validation_rules: this.getValidationRules(type)
      }
      
      // Find related fields
      enhancedField.related_fields = this.findRelatedFields(enhancedField, rawFields)
      
      enhancedFields.push(enhancedField)
    }
    
    // Store enhanced fields in database
    const supabase = createClient()
    
    // Clear existing enhanced fields
    await supabase
      .from('document_form_fields')
      .delete()
      .eq('document_id', documentId)
    
    // Insert enhanced fields
    const fieldsToInsert = enhancedFields.map(field => ({
      document_id: documentId,
      field_name: field.field_name,
      field_label: field.field_label,
      field_type: field.field_type,
      field_value: field.field_value,
      confidence: field.confidence,
      coordinates: field.coordinates,
      page_number: field.coordinates?.page || 1,
      metadata: {
        icon: field.icon,
        required: field.required,
        placeholder: field.placeholder,
        help_text: field.help_text,
        validation_pattern: field.validation_pattern,
        related_fields: field.related_fields
      }
    }))
    
    if (fieldsToInsert.length > 0) {
      await supabase
        .from('document_form_fields')
        .insert(fieldsToInsert)
    }
    
    return enhancedFields
  }

  // Check if field is required
  private isFieldRequired(fieldText: string): boolean {
    const requiredIndicators = ['*', 'required', 'mandatory', 'must']
    return requiredIndicators.some(indicator => 
      fieldText.toLowerCase().includes(indicator)
    )
  }

  // Get placeholder text for field
  private getPlaceholder(type: FieldType, _fieldName: string): string {
    const placeholders: Record<FieldType, string> = {
      [FieldType.EMAIL]: 'john.doe@example.com',
      [FieldType.PHONE]: '(555) 123-4567',
      [FieldType.DATE]: 'MM/DD/YYYY',
      [FieldType.SSN]: '123-45-6789',
      [FieldType.ZIP]: '12345',
      [FieldType.NUMBER]: '0',
      [FieldType.CURRENCY]: '$0.00',
      [FieldType.ADDRESS]: '123 Main St',
      [FieldType.TEXT]: 'Enter text...',
      [FieldType.CHECKBOX]: '',
      [FieldType.RADIO]: '',
      [FieldType.SIGNATURE]: 'Sign here',
      [FieldType.SELECT]: 'Select an option',
      [FieldType.TEXTAREA]: 'Enter details...'
    }
    return placeholders[type] || ''
  }

  // Get help text for field
  private getHelpText(type: FieldType, _fieldName: string): string {
    const helpTexts: Record<FieldType, string> = {
      [FieldType.EMAIL]: 'Enter a valid email address',
      [FieldType.PHONE]: 'Include area code',
      [FieldType.DATE]: 'Use MM/DD/YYYY format',
      [FieldType.SSN]: 'Enter 9-digit social security number',
      [FieldType.ZIP]: 'Enter 5 or 9 digit ZIP code',
      [FieldType.NUMBER]: 'Numbers only',
      [FieldType.CURRENCY]: 'Enter amount in dollars',
      [FieldType.ADDRESS]: 'Include street number and name',
      [FieldType.SIGNATURE]: 'Click to add signature',
      [FieldType.TEXT]: '',
      [FieldType.CHECKBOX]: 'Check if applicable',
      [FieldType.RADIO]: 'Select one option',
      [FieldType.SELECT]: 'Choose from list',
      [FieldType.TEXTAREA]: 'Provide detailed information'
    }
    return helpTexts[type] || ''
  }

  // Get validation pattern for field type
  private getValidationPattern(type: FieldType): string {
    const patterns: Record<FieldType, string> = {
      [FieldType.EMAIL]: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
      [FieldType.PHONE]: '^\\(?[0-9]{3}\\)?[-. ]?[0-9]{3}[-. ]?[0-9]{4}$',
      [FieldType.SSN]: '^[0-9]{3}-?[0-9]{2}-?[0-9]{4}$',
      [FieldType.ZIP]: '^[0-9]{5}(-[0-9]{4})?$',
      [FieldType.DATE]: '^(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])/[0-9]{4}$',
      [FieldType.NUMBER]: '^[0-9]+$',
      [FieldType.CURRENCY]: '^\\$?[0-9]+(\\.[0-9]{2})?$',
      [FieldType.TEXT]: '',
      [FieldType.ADDRESS]: '',
      [FieldType.CHECKBOX]: '',
      [FieldType.RADIO]: '',
      [FieldType.SIGNATURE]: '',
      [FieldType.SELECT]: '',
      [FieldType.TEXTAREA]: ''
    }
    return patterns[type] || ''
  }

  // Get validation rules for field type
  private getValidationRules(type: FieldType): any {
    const rules: Record<FieldType, any> = {
      [FieldType.EMAIL]: { max_length: 255 },
      [FieldType.PHONE]: { min_length: 10, max_length: 14 },
      [FieldType.SSN]: { min_length: 9, max_length: 11 },
      [FieldType.ZIP]: { min_length: 5, max_length: 10 },
      [FieldType.DATE]: { min_length: 10, max_length: 10 },
      [FieldType.NUMBER]: { min_length: 1 },
      [FieldType.CURRENCY]: { min_length: 1 },
      [FieldType.TEXT]: { max_length: 500 },
      [FieldType.ADDRESS]: { max_length: 255 },
      [FieldType.TEXTAREA]: { max_length: 5000 },
      [FieldType.CHECKBOX]: {},
      [FieldType.RADIO]: {},
      [FieldType.SIGNATURE]: {},
      [FieldType.SELECT]: {}
    }
    return rules[type] || {}
  }

  // Find related fields (e.g., billing and shipping address)
  private findRelatedFields(field: EnhancedFormField, allFields: any[]): string[] {
    const related: string[] = []
    const fieldNameLower = field.field_name.toLowerCase()
    
    // Find fields with similar names
    allFields.forEach(otherField => {
      if (otherField.id === field.id) return
      
      const otherNameLower = (otherField.field_name || '').toLowerCase()
      
      // Check for related patterns
      if (fieldNameLower.includes('billing') && otherNameLower.includes('shipping')) {
        related.push(otherField.id)
      } else if (fieldNameLower.includes('shipping') && otherNameLower.includes('billing')) {
        related.push(otherField.id)
      } else if (fieldNameLower.includes('confirm') && 
                 otherNameLower.replace('confirm', '') === fieldNameLower.replace('confirm', '')) {
        related.push(otherField.id)
      }
    })
    
    return related
  }

  // Auto-complete suggestions based on user history
  async getAutoCompleteSuggestions(
    userId: string,
    fieldType: FieldType,
    fieldName: string
  ): Promise<string[]> {
    const supabase = createClient()
    
    // Get user's previous form data
    const { data: previousData } = await supabase
      .from('document_filled_data')
      .select('value')
      .eq('user_id', userId)
      .ilike('field_id', `%${fieldName}%`)
      .limit(10)
    
    const suggestions = previousData?.map(d => d.value) || []
    
    // Add common suggestions based on field type
    if (fieldType === FieldType.ADDRESS) {
      suggestions.push(...['123 Main St', '456 Oak Ave', '789 Pine Blvd'])
    } else if (fieldType === FieldType.ZIP) {
      suggestions.push(...['10001', '90210', '60601'])
    }
    
    // Remove duplicates
    return Array.from(new Set(suggestions)).slice(0, 5)
  }
}

