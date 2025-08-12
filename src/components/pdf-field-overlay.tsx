'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from 'lucide-react'
import { FieldType, type EnhancedFormField } from '@/services/enhanced-form-detector'

interface PDFFieldOverlayProps {
  field: EnhancedFormField
  value: string | boolean
  scale: number
  pageNumber: number
  currentPage: number
  onFieldChange: (fieldId: string, value: any) => void
  onFieldFocus: (fieldId: string) => void
  onFieldBlur: (fieldId: string) => void
  isSelected: boolean
  pdfContainerRef?: React.RefObject<HTMLDivElement | null>
}

export function PDFFieldOverlay({
  field,
  value,
  scale,
  pageNumber,
  currentPage,
  onFieldChange,
  onFieldFocus,
  onFieldBlur,
  isSelected,
  pdfContainerRef
}: PDFFieldOverlayProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  // Only show fields on the current page
  if (field.page_number !== currentPage) {
    return null
  }

  // Parse coordinates from field
  const coords = field.coordinates || { x: 0, y: 0, width: 100, height: 30 }
  
  // Calculate position based on PDF scale
  const position = {
    left: coords.x * scale,
    top: coords.y * scale,
    width: coords.width * scale,
    height: coords.height * scale
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
    onFieldFocus(field.id)
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }

  const handleBlur = () => {
    setIsEditing(false)
    onFieldChange(field.id, localValue)
    onFieldBlur(field.id)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && field.field_type !== FieldType.TEXTAREA) {
      handleBlur()
    }
    if (e.key === 'Escape') {
      setLocalValue(value)
      setIsEditing(false)
      onFieldBlur(field.id)
    }
  }

  const renderInput = () => {
    switch (field.field_type) {
      case FieldType.CHECKBOX:
        return (
          <div className="flex items-center justify-center h-full">
            <Checkbox
              checked={localValue === true || localValue === 'true'}
              onCheckedChange={(checked) => {
                setLocalValue(checked)
                onFieldChange(field.id, checked)
              }}
              className="w-4 h-4"
            />
          </div>
        )

      case FieldType.SELECT:
        return (
          <Select
            value={localValue as string}
            onValueChange={(val) => {
              setLocalValue(val)
              onFieldChange(field.id, val)
            }}
          >
            <SelectTrigger className="h-full w-full border-0 focus:ring-0">
              <SelectValue placeholder={field.placeholder || 'Select...'} />
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
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={localValue as string}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={field.placeholder}
            className="h-full w-full resize-none border-0 focus:ring-0 p-1 text-xs"
            style={{ fontSize: Math.max(10, position.height / 3) + 'px' }}
          />
        )

      case FieldType.DATE:
        return (
          <div className="relative h-full w-full">
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="date"
              value={localValue as string}
              onChange={(e) => setLocalValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="h-full w-full border-0 focus:ring-0 pl-1 pr-8 text-xs"
              style={{ fontSize: Math.max(10, position.height / 3) + 'px' }}
            />
            <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
        )

      default:
        return (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={field.field_type === FieldType.EMAIL ? 'email' : 
                  field.field_type === FieldType.NUMBER ? 'number' : 'text'}
            value={localValue as string}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={field.placeholder}
            className="h-full w-full border-0 focus:ring-0 px-1 text-xs"
            style={{ fontSize: Math.max(10, position.height / 3) + 'px' }}
          />
        )
    }
  }

  return (
    <div
      className={cn(
        'absolute transition-all duration-200 cursor-pointer',
        'border-2 rounded',
        isEditing ? [
          'border-blue-500 bg-white shadow-lg z-20',
          'ring-2 ring-blue-500 ring-opacity-30'
        ] : isSelected ? [
          'border-blue-400 bg-blue-50 bg-opacity-30'
        ] : isHovered ? [
          'border-blue-300 bg-blue-50 bg-opacity-20'
        ] : [
          'border-transparent hover:border-blue-200',
          'hover:bg-blue-50 hover:bg-opacity-10'
        ]
      )}
      style={position}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      {/* Field Label (shown on hover or when selected) */}
      {(isHovered || isSelected || isEditing) && !isEditing && (
        <div className="absolute -top-5 left-0 flex items-center gap-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded whitespace-nowrap">
          <span>{field.icon}</span>
          <span>{field.field_label}</span>
          {field.required && <span className="text-red-300">*</span>}
        </div>
      )}

      {/* Input Field */}
      {isEditing ? (
        renderInput()
      ) : (
        <div className="h-full w-full flex items-center px-1 text-xs overflow-hidden">
          <span className={cn(
            'truncate',
            !value && 'text-gray-400 italic'
          )}>
            {value || field.placeholder || `Enter ${field.field_label?.toLowerCase()}`}
          </span>
        </div>
      )}

      {/* Confidence Indicator */}
      {field.confidence < 0.7 && (isHovered || isSelected) && (
        <div className="absolute -bottom-5 left-0 text-xs text-amber-600 bg-amber-50 px-1 py-0.5 rounded">
          Low confidence: {Math.round(field.confidence * 100)}%
        </div>
      )}
    </div>
  )
}