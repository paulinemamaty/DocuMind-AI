'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  X,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Copy,
  ClipboardCopy,
  RefreshCw,
  Check,
  AlertCircle,
  Zap,
  Target,
  TrendingUp,
  FileText,
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  CreditCard,
  Lock,
  Building
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FieldType, type EnhancedFormField, type FieldGroup } from '@/services/enhanced-form-detector'
import { AutoFillService, type AutoFillSuggestion } from '@/services/auto-fill-service'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface FloatingFieldPanelProps {
  fields: EnhancedFormField[]
  groups: FieldGroup[]
  formData: Record<string, any>
  errors: Record<string, string>
  onFieldChange: (fieldId: string, value: any) => void
  onQuickFill: (pattern: string) => void
  onCopyFields: (from: string, to: string) => void
  onValidate: (fieldId: string) => void
  onSave: () => void
}

export function FloatingFieldPanel({
  fields,
  groups,
  formData,
  errors,
  onFieldChange,
  onQuickFill,
  onCopyFields,
  onValidate,
  onSave
}: FloatingFieldPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [suggestions, setSuggestions] = useState<Record<string, AutoFillSuggestion[]>>({})
  const [autoFillService] = useState(() => new AutoFillService())
  const [focusedField, setFocusedField] = useState<string | null>(null)

  // Calculate completion percentage
  const totalFields = fields.length
  const filledFields = fields.filter(f => formData[f.id] && formData[f.id] !== '').length
  const requiredFields = fields.filter(f => f.required)
  const filledRequired = requiredFields.filter(f => formData[f.id] && formData[f.id] !== '').length
  const completionPercentage = Math.round((filledFields / totalFields) * 100)
  const requiredPercentage = Math.round((filledRequired / requiredFields.length) * 100)

  // Load suggestions when field is focused
  useEffect(() => {
    if (focusedField) {
      const field = fields.find(f => f.id === focusedField)
      if (field) {
        autoFillService.getSuggestions(field).then(sugs => {
          setSuggestions(prev => ({ ...prev, [focusedField]: sugs }))
        })
      }
    }
  }, [focusedField, fields, autoFillService])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const currentIndex = fields.findIndex(f => f.id === focusedField)
        if (e.shiftKey) {
          // Previous field
          if (currentIndex > 0) {
            setFocusedField(fields[currentIndex - 1].id)
            e.preventDefault()
          }
        } else {
          // Next field
          if (currentIndex < fields.length - 1) {
            setFocusedField(fields[currentIndex + 1].id)
            e.preventDefault()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusedField, fields])

  // Render field input based on type
  const renderFieldInput = (field: EnhancedFormField) => {
    const value = formData[field.id] || ''
    const error = errors[field.id]
    const fieldSuggestions = suggestions[field.id] || []

    const handleChange = (newValue: any) => {
      // Auto-format value
      const formatted = autoFillService.autoFormat(newValue, field.field_type)
      onFieldChange(field.id, formatted)
      
      // Save to history
      if (formatted && formatted.length > 2) {
        autoFillService.saveFieldValue(field, formatted)
      }
    }

    switch (field.field_type) {
      case FieldType.CHECKBOX:
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={value === 'true' || value === true}
              onCheckedChange={(checked) => handleChange(checked)}
            />
            <Label htmlFor={field.id} className="text-sm">
              {field.field_label}
            </Label>
          </div>
        )

      case FieldType.RADIO:
        return (
          <RadioGroup value={value} onValueChange={handleChange}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="option1" id={`${field.id}-1`} />
              <Label htmlFor={`${field.id}-1`}>Option 1</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="option2" id={`${field.id}-2`} />
              <Label htmlFor={`${field.id}-2`}>Option 2</Label>
            </div>
          </RadioGroup>
        )

      case FieldType.SELECT:
        return (
          <Select value={value} onValueChange={handleChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={field.placeholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="option1">Option 1</SelectItem>
              <SelectItem value="option2">Option 2</SelectItem>
              <SelectItem value="option3">Option 3</SelectItem>
            </SelectContent>
          </Select>
        )

      case FieldType.TEXTAREA:
        return (
          <Textarea
            id={field.id}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            className={cn(
              'min-h-[80px]',
              error && 'border-red-500'
            )}
            onFocus={() => setFocusedField(field.id)}
            onBlur={() => onValidate(field.id)}
          />
        )

      default:
        return (
          <div className="relative">
            <Input
              id={field.id}
              type={field.field_type === FieldType.EMAIL ? 'email' : 
                    field.field_type === FieldType.DATE ? 'date' :
                    field.field_type === FieldType.NUMBER ? 'number' : 'text'}
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={field.placeholder}
              className={cn(
                'pr-10',
                error && 'border-red-500',
                field.confidence < 0.7 && 'border-amber-500'
              )}
              onFocus={() => setFocusedField(field.id)}
              onBlur={() => onValidate(field.id)}
            />
            
            {/* Confidence indicator */}
            {field.confidence < 0.7 && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Tooltip>
                  <TooltipTrigger>
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Low confidence: {Math.round(field.confidence * 100)}%
                  </TooltipContent>
                </Tooltip>
              </div>
            )}

            {/* Suggestions dropdown */}
            {fieldSuggestions.length > 0 && focusedField === field.id && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-10">
                {fieldSuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                    onClick={() => {
                      handleChange(suggestion.value)
                      setFocusedField(null)
                    }}
                  >
                    <span>{suggestion.value}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {suggestion.source}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {Math.round(suggestion.confidence * 100)}%
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
    }
  }

  return (
    <TooltipProvider>
      <div
        className={cn(
          'fixed right-4 top-20 w-96 max-h-[calc(100vh-100px)]',
          'bg-white/95 backdrop-blur-xl backdrop-saturate-150',
          'border border-gray-200/50 rounded-xl shadow-2xl',
          'transition-all duration-300 ease-out',
          isExpanded ? 'translate-x-0' : 'translate-x-[360px]'
        )}
        style={{
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Form Fields</h3>
              <Badge variant="outline" className="ml-2">
                {filledFields}/{totalFields}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </Button>
          </div>

          {/* Progress Bars */}
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Overall Completion</span>
                <span>{completionPercentage}%</span>
              </div>
              <Progress value={completionPercentage} className="h-2" />
            </div>
            {requiredFields.length > 0 && (
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Required Fields</span>
                  <span>{requiredPercentage}%</span>
                </div>
                <Progress value={requiredPercentage} className="h-2 bg-red-100" />
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onQuickFill('common')}
              className="flex-1"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Quick Fill
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCopyFields('billing', 'shipping')}
              className="flex-1"
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy Fields
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={onSave}
              className="flex-1"
            >
              <Check className="w-3 h-3 mr-1" />
              Save
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="w-full rounded-none border-b">
            <TabsTrigger value="all" className="flex-1">All Fields</TabsTrigger>
            <TabsTrigger value="required" className="flex-1">
              Required
              {requiredFields.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">
                  {requiredFields.length - filledRequired}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex-1">Groups</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(100vh-380px)]">
            <TabsContent value="all" className="p-4 space-y-4">
              {fields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={field.id} className="flex items-center gap-2">
                    <span className="text-lg">{field.icon}</span>
                    <span className="text-sm font-medium">{field.field_label}</span>
                    {field.required && <span className="text-red-500">*</span>}
                  </Label>
                  {renderFieldInput(field)}
                  {errors[field.id] && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors[field.id]}
                    </p>
                  )}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="required" className="p-4 space-y-4">
              {requiredFields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={field.id} className="flex items-center gap-2">
                    <span className="text-lg">{field.icon}</span>
                    <span className="text-sm font-medium">{field.field_label}</span>
                    <span className="text-red-500">*</span>
                  </Label>
                  {renderFieldInput(field)}
                  {errors[field.id] && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors[field.id]}
                    </p>
                  )}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="groups" className="p-4 space-y-4">
              {groups.map((group) => (
                <div key={group.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm text-gray-900">{group.name}</h4>
                    <Badge variant="outline" className="text-xs">
                      {group.fields.filter(fId => formData[fId]).length}/{group.fields.length}
                    </Badge>
                  </div>
                  <div className="pl-4 space-y-3">
                    {group.fields.map(fieldId => {
                      const field = fields.find(f => f.id === fieldId)
                      if (!field) return null
                      return (
                        <div key={field.id} className="space-y-2">
                          <Label htmlFor={field.id} className="flex items-center gap-2">
                            <span className="text-lg">{field.icon}</span>
                            <span className="text-sm">{field.field_label}</span>
                            {field.required && <span className="text-red-500">*</span>}
                          </Label>
                          {renderFieldInput(field)}
                        </div>
                      )
                    })}
                  </div>
                  <Separator />
                </div>
              ))}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Expand/Collapse Tab */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full',
            'w-8 h-20 bg-white/95 backdrop-blur-xl',
            'border border-r-0 border-gray-200/50 rounded-l-lg',
            'flex items-center justify-center',
            'hover:bg-gray-50 transition-colors'
          )}
        >
          {isExpanded ? (
            <ChevronRight className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          )}
        </button>
      </div>
    </TooltipProvider>
  )
}