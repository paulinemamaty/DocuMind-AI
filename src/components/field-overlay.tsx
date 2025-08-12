'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Check, AlertCircle, Info } from 'lucide-react'
import { FieldType, FIELD_ICONS, type EnhancedFormField } from '@/services/enhanced-form-detector'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface FieldOverlayProps {
  field: EnhancedFormField
  value: string
  isValid: boolean
  isFocused: boolean
  hasWarning?: boolean
  error?: string
  suggestion?: string
  onFocus: () => void
  onBlur: () => void
  onChange: (value: string) => void
  position: {
    x: number
    y: number
    width: number
    height: number
  }
}

export function FieldOverlay({
  field,
  value,
  isValid,
  isFocused,
  hasWarning,
  error,
  suggestion,
  onFocus,
  onBlur,
  onChange,
  position
}: FieldOverlayProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  // Show tooltip on hover after delay
  useEffect(() => {
    if (isHovered) {
      const timer = setTimeout(() => setShowTooltip(true), 500)
      return () => clearTimeout(timer)
    } else {
      setShowTooltip(false)
    }
  }, [isHovered])

  // Get validation icon
  const getValidationIcon = () => {
    if (error) return <AlertCircle className="w-4 h-4 text-red-500" />
    if (hasWarning) return <AlertCircle className="w-4 h-4 text-amber-500" />
    if (isValid && value) return <Check className="w-4 h-4 text-green-500" />
    return null
  }

  // Get field style based on state
  const getFieldStyle = () => {
    const baseStyle = {
      position: 'absolute' as const,
      left: position.x,
      top: position.y,
      width: position.width,
      height: position.height,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      borderRadius: '4px',
    }

    let boxShadow = ''
    let background = 'transparent'
    let border = '2px solid transparent'

    if (isFocused) {
      // Blue glow effect when focused
      boxShadow = '0 0 0 3px rgba(0, 102, 204, 0.1), 0 0 20px rgba(0, 102, 204, 0.4), inset 0 0 10px rgba(0, 102, 204, 0.1)'
      border = '2px solid #0066CC'
      background = 'rgba(0, 102, 204, 0.05)'
    } else if (isHovered) {
      // Subtle glow on hover
      boxShadow = '0 0 0 2px rgba(0, 102, 204, 0.05), 0 0 15px rgba(0, 102, 204, 0.2)'
      border = '2px solid rgba(0, 102, 204, 0.3)'
      background = 'rgba(0, 102, 204, 0.02)'
    } else if (error) {
      // Red glow for errors
      boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.1), 0 0 10px rgba(239, 68, 68, 0.2)'
      border = '2px solid rgba(239, 68, 68, 0.3)'
    } else if (hasWarning) {
      // Amber glow for warnings
      boxShadow = '0 0 0 2px rgba(245, 158, 11, 0.1), 0 0 10px rgba(245, 158, 11, 0.2)'
      border = '2px solid rgba(245, 158, 11, 0.3)'
    } else if (isValid && value) {
      // Green glow for valid filled fields
      boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.1), 0 0 10px rgba(16, 185, 129, 0.2)'
      border = '2px solid rgba(16, 185, 129, 0.3)'
    } else {
      // Default subtle blue glow for detected fields
      boxShadow = '0 0 10px rgba(0, 102, 204, 0.15)'
      border = '2px solid rgba(0, 102, 204, 0.2)'
    }

    return {
      ...baseStyle,
      boxShadow,
      background,
      border,
    }
  }

  return (
    <TooltipProvider>
      <div
        style={getFieldStyle()}
        className="field-overlay pointer-events-auto"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        {/* Floating Label */}
        {(isFocused || isHovered || value) && (
          <div 
            className="absolute -top-6 left-0 flex items-center gap-1 px-2 py-1 bg-white rounded-md shadow-lg border border-gray-200"
            style={{
              fontSize: '11px',
              fontWeight: 500,
              animation: 'fadeInUp 0.2s ease-out',
            }}
          >
            <span className="text-lg">{field.icon}</span>
            <span className="text-gray-700">{field.field_label}</span>
            {field.required && <span className="text-red-500">*</span>}
            <div className="ml-2">{getValidationIcon()}</div>
          </div>
        )}

        {/* Field Description Tooltip */}
        {showTooltip && (field.help_text || suggestion) && (
          <Tooltip open={showTooltip}>
            <TooltipTrigger asChild>
              <div className="absolute -right-2 top-1/2 -translate-y-1/2">
                <Info className="w-4 h-4 text-blue-500" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <div className="space-y-2">
                {field.help_text && (
                  <p className="text-sm text-gray-600">{field.help_text}</p>
                )}
                {suggestion && (
                  <p className="text-sm text-blue-600 font-medium">
                    💡 {suggestion}
                  </p>
                )}
                {field.confidence < 0.7 && (
                  <p className="text-xs text-amber-600">
                    ⚠️ Low confidence ({Math.round(field.confidence * 100)}%)
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Validation Feedback */}
        {error && (
          <div 
            className="absolute -bottom-6 left-0 flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded-md shadow-md border border-red-200"
            style={{
              fontSize: '11px',
              animation: 'fadeInDown 0.2s ease-out',
            }}
          >
            <AlertCircle className="w-3 h-3" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .field-overlay {
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
        }
      `}</style>
    </TooltipProvider>
  )
}