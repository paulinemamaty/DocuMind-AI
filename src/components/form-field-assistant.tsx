'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Info, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Lightbulb,
  Sparkles,
  Volume2,
  Eye,
  EyeOff,
  Mic,
  MicOff,
  Copy,
  ClipboardCheck,
  History,
  FileText,
  HelpCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

// Field validation rules and patterns
const FIELD_VALIDATORS = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    format: 'email@example.com',
    message: 'Enter a valid email address'
  },
  phone: {
    pattern: /^(\+1)?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/,
    format: '(123) 456-7890',
    message: 'Enter a 10-digit phone number'
  },
  ssn: {
    pattern: /^\d{3}-?\d{2}-?\d{4}$/,
    format: '123-45-6789',
    message: 'Enter a valid SSN (XXX-XX-XXXX)'
  },
  date: {
    pattern: /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/,
    format: 'MM/DD/YYYY',
    message: 'Enter date as MM/DD/YYYY'
  },
  zip: {
    pattern: /^\d{5}(-\d{4})?$/,
    format: '12345 or 12345-6789',
    message: 'Enter a valid ZIP code'
  },
  ein: {
    pattern: /^\d{2}-?\d{7}$/,
    format: '12-3456789',
    message: 'Enter a valid EIN (XX-XXXXXXX)'
  }
}

// Field help content
const FIELD_HELP = {
  name: {
    description: 'Your legal name as it appears on official documents',
    examples: ['John Smith', 'Jane M. Doe'],
    tips: ['Use your full legal name', 'Include middle initial if required'],
    common_mistakes: ['Using nicknames', 'Omitting middle name when required']
  },
  ssn: {
    description: 'Your 9-digit Social Security Number',
    examples: ['123-45-6789'],
    tips: ['Include dashes for clarity', 'Double-check all digits'],
    common_mistakes: ['Transposing digits', 'Using incorrect format']
  },
  address: {
    description: 'Your current residential address',
    examples: ['123 Main St, Apt 4B', '456 Oak Avenue'],
    tips: ['Include apartment/unit number', 'Use standard abbreviations'],
    common_mistakes: ['Missing apartment number', 'Using PO Box when not allowed']
  },
  email: {
    description: 'Your primary email address for communications',
    examples: ['john.doe@email.com', 'jane_smith@company.org'],
    tips: ['Use an email you check regularly', 'Ensure it\'s typed correctly'],
    common_mistakes: ['Typos in domain name', 'Using outdated email']
  },
  phone: {
    description: 'Your primary contact phone number',
    examples: ['(555) 123-4567', '555-123-4567'],
    tips: ['Include area code', 'Use a number you can be reached at'],
    common_mistakes: ['Missing area code', 'Using disconnected number']
  },
  date: {
    description: 'Date in MM/DD/YYYY format',
    examples: ['01/15/2024', '12/31/2023'],
    tips: ['Use leading zeros for single digits', 'Verify year is correct'],
    common_mistakes: ['Wrong date format', 'Invalid dates like 02/30/2024']
  }
}

interface FormFieldAssistantProps {
  field: {
    id: string
    field_type: string
    field_name: string
    field_label: string
    value?: string
    required?: boolean
    confidence?: number
    validation?: string
  }
  value: string
  onChange: (value: string) => void
  onValidation?: (isValid: boolean, message?: string) => void
  enableAI?: boolean
  enableVoice?: boolean
  previousValues?: string[]
  allFormData?: Record<string, any> // For cross-field validation
  onCrossfieldUpdate?: (updates: Record<string, any>) => void // For updating related fields
}

export function FormFieldAssistant({
  field,
  value,
  onChange,
  onValidation,
  enableAI = true,
  enableVoice = false,
  previousValues = [],
  allFormData = {},
  onCrossfieldUpdate
}: FormFieldAssistantProps) {
  const [isValid, setIsValid] = useState(true)
  const [validationMessage, setValidationMessage] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showHelp, setShowHelp] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [copied, setCopied] = useState(false)
  const [aiHelp, setAiHelp] = useState<any>(null)
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const supabase = createClient()

  // Detect field type from name and label
  const detectFieldType = useCallback(() => {
    const nameLabel = `${field.field_name} ${field.field_label}`.toLowerCase()
    
    if (nameLabel.includes('email')) return 'email'
    if (nameLabel.includes('phone') || nameLabel.includes('tel')) return 'phone'
    if (nameLabel.includes('ssn') || nameLabel.includes('social')) return 'ssn'
    if (nameLabel.includes('date') || nameLabel.includes('dob')) return 'date'
    if (nameLabel.includes('zip') || nameLabel.includes('postal')) return 'zip'
    if (nameLabel.includes('ein') || nameLabel.includes('employer')) return 'ein'
    if (nameLabel.includes('name')) return 'name'
    if (nameLabel.includes('address') || nameLabel.includes('street')) return 'address'
    
    return field.field_type || 'text'
  }, [field])

  // Cross-field validation logic
  const validateCrossField = useCallback((inputValue: string) => {
    const fieldName = field.field_name.toLowerCase()
    const fieldLabel = field.field_label.toLowerCase()

    // Validate email confirmation
    if ((fieldName.includes('confirm') || fieldName.includes('verify')) && fieldName.includes('email')) {
      const emailField = Object.entries(allFormData).find(([key, val]) => 
        key.toLowerCase().includes('email') && !key.toLowerCase().includes('confirm')
      )
      if (emailField && emailField[1] !== inputValue) {
        return { isValid: false, message: 'Email addresses do not match' }
      }
    }

    // Validate password confirmation
    if ((fieldName.includes('confirm') || fieldName.includes('verify')) && fieldName.includes('password')) {
      const passwordField = Object.entries(allFormData).find(([key, val]) => 
        key.toLowerCase().includes('password') && !key.toLowerCase().includes('confirm')
      )
      if (passwordField && passwordField[1] !== inputValue) {
        return { isValid: false, message: 'Passwords do not match' }
      }
    }

    // Validate date ranges
    if (fieldName.includes('end') && fieldName.includes('date')) {
      const startDateField = Object.entries(allFormData).find(([key, val]) => 
        key.toLowerCase().includes('start') && key.toLowerCase().includes('date')
      )
      if (startDateField && startDateField[1]) {
        const startDate = new Date(startDateField[1])
        const endDate = new Date(inputValue)
        if (endDate < startDate) {
          return { isValid: false, message: 'End date must be after start date' }
        }
      }
    }

    // Validate ZIP code matches state
    if (fieldName.includes('zip') || fieldName.includes('postal')) {
      const stateField = Object.entries(allFormData).find(([key, val]) => 
        key.toLowerCase().includes('state')
      )
      if (stateField && stateField[1] && inputValue) {
        // Basic ZIP validation for US states
        const zipPrefix = inputValue.substring(0, 2)
        const stateZipMap: Record<string, string[]> = {
          'NY': ['10', '11', '12', '13', '14'],
          'CA': ['90', '91', '92', '93', '94', '95', '96'],
          'TX': ['75', '76', '77', '78', '79'],
          'FL': ['32', '33', '34'],
          // Add more as needed
        }
        const validPrefixes = stateZipMap[stateField[1] as string]
        if (validPrefixes && !validPrefixes.includes(zipPrefix)) {
          return { isValid: false, message: `ZIP code doesn't match state ${stateField[1]}` }
        }
      }
    }

    return { isValid: true }
  }, [allFormData, field])

  // Validate field value
  const validateField = useCallback((inputValue: string) => {
    if (!inputValue && field.required) {
      setIsValid(false)
      setValidationMessage('This field is required')
      onValidation?.(false, 'This field is required')
      return false
    }

    const fieldType = detectFieldType()
    const validator = FIELD_VALIDATORS[fieldType as keyof typeof FIELD_VALIDATORS]
    
    if (validator && inputValue) {
      const valid = validator.pattern.test(inputValue)
      setIsValid(valid)
      setValidationMessage(valid ? '' : validator.message)
      onValidation?.(valid, valid ? '' : validator.message)
      
      if (!valid) return false
    }

    // Cross-field validation
    const crossValidation = validateCrossField(inputValue)
    if (!crossValidation.isValid) {
      setIsValid(false)
      setValidationMessage(crossValidation.message || '')
      onValidation?.(false, crossValidation.message)
      return false
    }

    setIsValid(true)
    setValidationMessage('')
    onValidation?.(true)
    return true
  }, [field, detectFieldType, onValidation, allFormData, validateCrossField])

  // Format value based on field type
  const formatValue = useCallback((inputValue: string) => {
    const fieldType = detectFieldType()
    
    switch (fieldType) {
      case 'phone':
        // Format as (XXX) XXX-XXXX
        const cleaned = inputValue.replace(/\D/g, '')
        if (cleaned.length >= 10) {
          return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
        }
        break
      case 'ssn':
        // Format as XXX-XX-XXXX
        const ssnCleaned = inputValue.replace(/\D/g, '')
        if (ssnCleaned.length >= 9) {
          return `${ssnCleaned.slice(0, 3)}-${ssnCleaned.slice(3, 5)}-${ssnCleaned.slice(5, 9)}`
        }
        break
      case 'date':
        // Auto-add slashes for MM/DD/YYYY
        const dateCleaned = inputValue.replace(/\D/g, '')
        if (dateCleaned.length >= 8) {
          return `${dateCleaned.slice(0, 2)}/${dateCleaned.slice(2, 4)}/${dateCleaned.slice(4, 8)}`
        }
        break
    }
    
    return inputValue
  }, [detectFieldType])

  // Generate smart suggestions
  const generateSuggestions = useCallback(async (inputValue: string) => {
    const fieldType = detectFieldType()
    const suggestions: string[] = []

    // Use previous values if available
    if (previousValues.length > 0) {
      const filtered = previousValues.filter(v => 
        v.toLowerCase().includes(inputValue.toLowerCase())
      )
      suggestions.push(...filtered.slice(0, 3))
    }

    // Add common patterns
    if (fieldType === 'email' && inputValue.includes('@')) {
      const commonDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com']
      const [localPart] = inputValue.split('@')
      commonDomains.forEach(domain => {
        suggestions.push(`${localPart}@${domain}`)
      })
    }

    setSuggestions(suggestions.slice(0, 5))
  }, [detectFieldType, previousValues])

  // Get AI-powered help
  const getAIHelp = useCallback(async () => {
    if (!enableAI) return

    setIsLoadingAI(true)
    try {
      const response = await fetch('/api/ai/field-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldName: field.field_name,
          fieldLabel: field.field_label,
          fieldType: detectFieldType(),
          currentValue: value
        })
      })

      if (response.ok) {
        const help = await response.json()
        setAiHelp(help)
      }
    } catch (error) {
      console.error('Failed to get AI help:', error)
    } finally {
      setIsLoadingAI(false)
    }
  }, [enableAI, field, value, detectFieldType])

  // Handle voice input
  const handleVoiceInput = useCallback(() => {
    if (!enableVoice || !('webkitSpeechRecognition' in window)) return

    const recognition = new (window as any).webkitSpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      onChange(formatValue(transcript))
      validateField(transcript)
    }

    if (isListening) {
      recognition.stop()
    } else {
      recognition.start()
    }
  }, [enableVoice, isListening, onChange, formatValue, validateField])

  // Handle value change
  const handleChange = (newValue: string) => {
    const formatted = formatValue(newValue)
    onChange(formatted)
    validateField(formatted)
    if (formatted.length > 2) {
      generateSuggestions(formatted)
    }
  }

  // Copy to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    validateField(value)
  }, [value, validateField])

  const fieldType = detectFieldType()
  const helpContent = FIELD_HELP[fieldType as keyof typeof FIELD_HELP]
  const validator = FIELD_VALIDATORS[fieldType as keyof typeof FIELD_VALIDATORS]

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label 
          htmlFor={field.id} 
          className="flex items-center gap-2 text-sm font-medium"
        >
          {field.field_label}
          {field.required && <span className="text-red-500">*</span>}
          {field.confidence && field.confidence < 0.8 && (
            <Badge variant="outline" className="text-xs">
              Low confidence: {Math.round(field.confidence * 100)}%
            </Badge>
          )}
        </Label>
        
        <div className="flex items-center gap-1">
          {/* Help button */}
          <Popover open={showHelp} onOpenChange={setShowHelp}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <HelpCircle className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-3">
                {helpContent && (
                  <>
                    <div>
                      <h4 className="font-medium text-sm mb-1">About this field</h4>
                      <p className="text-xs text-muted-foreground">{helpContent.description}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm mb-1">Examples</h4>
                      <div className="space-y-1">
                        {helpContent.examples.map((ex, i) => (
                          <Badge key={i} variant="secondary" className="text-xs mr-1">
                            {ex}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {helpContent.tips.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-1">Tips</h4>
                        <ul className="text-xs text-muted-foreground space-y-0.5">
                          {helpContent.tips.map((tip, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <CheckCircle className="h-3 w-3 text-green-500 mt-0.5" />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
                {validator && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Format</h4>
                    <Badge variant="outline" className="text-xs">
                      {validator.format}
                    </Badge>
                  </div>
                )}
                {enableAI && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={getAIHelp}
                    disabled={isLoadingAI}
                    className="w-full"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {isLoadingAI ? 'Getting AI help...' : 'Get AI assistance'}
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Voice input */}
          {enableVoice && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0"
              onClick={handleVoiceInput}
            >
              {isListening ? (
                <MicOff className="h-3.5 w-3.5 text-red-500" />
              ) : (
                <Mic className="h-3.5 w-3.5" />
              )}
            </Button>
          )}

          {/* Copy button */}
          {value && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0"
              onClick={copyToClipboard}
            >
              {copied ? (
                <ClipboardCheck className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Input field with validation */}
      <div className="relative">
        {field.field_type === 'textarea' ? (
          <Textarea
            id={field.id}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={validator?.format || 'Enter value...'}
            className={cn(
              "min-h-[80px]",
              !isValid && "border-red-500 focus:ring-red-500"
            )}
          />
        ) : (
          <Input
            id={field.id}
            type={fieldType === 'email' ? 'email' : 'text'}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={validator?.format || 'Enter value...'}
            className={cn(
              !isValid && "border-red-500 focus:ring-red-500",
              isValid && value && "border-green-500"
            )}
          />
        )}
        
        {/* Validation indicator */}
        <div className="absolute right-2 top-2">
          {value && (
            isValid ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )
          )}
        </div>
      </div>

      {/* Validation message */}
      {!isValid && validationMessage && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {validationMessage}
        </p>
      )}

      {/* Smart suggestions */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-muted-foreground">Suggestions:</span>
          {suggestions.map((suggestion, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground"
              onClick={() => {
                onChange(suggestion)
                validateField(suggestion)
                setSuggestions([])
              }}
            >
              {suggestion}
            </Badge>
          ))}
        </div>
      )}

      {/* AI Help Content */}
      {aiHelp && (
        <Card className="mt-2 bg-blue-50 border-blue-200">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-medium text-blue-900">AI Assistant says:</p>
                <p className="text-blue-800">{aiHelp.suggestion}</p>
                {aiHelp.correction && (
                  <p className="text-blue-700">
                    Did you mean: <span className="font-medium">{aiHelp.correction}</span>?
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}