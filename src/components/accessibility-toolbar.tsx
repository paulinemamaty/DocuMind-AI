'use client'

import { useState, useEffect } from 'react'
import { 
  Eye, 
  Mic, 
  Volume2,
  ZoomIn,
  ZoomOut,
  Type,
  Palette,
  Keyboard,
  Settings,
  Sun,
  Moon,
  Contrast,
  Focus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface AccessibilityToolbarProps {
  onFontSizeChange?: (size: number) => void
  onHighContrastToggle?: (enabled: boolean) => void
  onFocusModeToggle?: (enabled: boolean) => void
  onScreenReaderToggle?: (enabled: boolean) => void
  className?: string
}

export function AccessibilityToolbar({
  onFontSizeChange,
  onHighContrastToggle,
  onFocusModeToggle,
  onScreenReaderToggle,
  className
}: AccessibilityToolbarProps) {
  const [fontSize, setFontSize] = useState(100)
  const [highContrast, setHighContrast] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [screenReader, setScreenReader] = useState(false)
  const [voiceInput, setVoiceInput] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)

  // Check for system preferences
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check for reduced motion preference
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      setReduceMotion(prefersReducedMotion)

      // Check for dark mode preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setDarkMode(prefersDark)

      // Check for high contrast preference
      const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches
      setHighContrast(prefersHighContrast)
    }
  }, [])

  // Apply accessibility settings
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement

      // Font size
      root.style.fontSize = `${fontSize}%`

      // High contrast
      if (highContrast) {
        root.classList.add('high-contrast')
      } else {
        root.classList.remove('high-contrast')
      }

      // Focus mode
      if (focusMode) {
        root.classList.add('focus-mode')
      } else {
        root.classList.remove('focus-mode')
      }

      // Dark mode
      if (darkMode) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }

      // Reduced motion
      if (reduceMotion) {
        root.classList.add('reduce-motion')
      } else {
        root.classList.remove('reduce-motion')
      }
    }
  }, [fontSize, highContrast, focusMode, darkMode, reduceMotion])

  // Screen reader announcements
  const announce = (message: string) => {
    if (screenReader && typeof window !== 'undefined') {
      const announcement = document.createElement('div')
      announcement.setAttribute('role', 'status')
      announcement.setAttribute('aria-live', 'polite')
      announcement.className = 'sr-only'
      announcement.textContent = message
      document.body.appendChild(announcement)
      setTimeout(() => document.body.removeChild(announcement), 1000)
    }
  }

  const handleFontSizeChange = (newSize: number[]) => {
    const size = newSize[0]
    setFontSize(size)
    onFontSizeChange?.(size)
    announce(`Font size changed to ${size}%`)
  }

  const handleHighContrastToggle = (enabled: boolean) => {
    setHighContrast(enabled)
    onHighContrastToggle?.(enabled)
    announce(`High contrast ${enabled ? 'enabled' : 'disabled'}`)
  }

  const handleFocusModeToggle = (enabled: boolean) => {
    setFocusMode(enabled)
    onFocusModeToggle?.(enabled)
    announce(`Focus mode ${enabled ? 'enabled' : 'disabled'}`)
  }

  const handleScreenReaderToggle = (enabled: boolean) => {
    setScreenReader(enabled)
    onScreenReaderToggle?.(enabled)
    announce(`Screen reader support ${enabled ? 'enabled' : 'disabled'}`)
  }

  const resetSettings = () => {
    setFontSize(100)
    setHighContrast(false)
    setFocusMode(false)
    setScreenReader(false)
    setVoiceInput(false)
    setDarkMode(false)
    setReduceMotion(false)
    announce('Accessibility settings reset to defaults')
  }

  const keyboardShortcuts = [
    { key: 'Alt+Z', description: 'Increase font size' },
    { key: 'Alt+X', description: 'Decrease font size' },
    { key: 'Alt+C', description: 'Toggle high contrast' },
    { key: 'Alt+F', description: 'Toggle focus mode' },
    { key: 'Alt+R', description: 'Toggle screen reader' },
    { key: 'Tab', description: 'Navigate between fields' },
    { key: 'Enter', description: 'Submit form field' },
    { key: 'Escape', description: 'Cancel current action' }
  ]

  // Set up keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault()
            setFontSize(prev => Math.min(150, prev + 10))
            break
          case 'x':
            e.preventDefault()
            setFontSize(prev => Math.max(50, prev - 10))
            break
          case 'c':
            e.preventDefault()
            setHighContrast(prev => !prev)
            break
          case 'f':
            e.preventDefault()
            setFocusMode(prev => !prev)
            break
          case 'r':
            e.preventDefault()
            setScreenReader(prev => !prev)
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Quick toggles */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleHighContrastToggle(!highContrast)}
        aria-label="Toggle high contrast"
        title="Toggle high contrast"
      >
        <Contrast className={cn("h-4 w-4", highContrast && "text-blue-600")} />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setDarkMode(!darkMode)}
        aria-label="Toggle dark mode"
        title="Toggle dark mode"
      >
        {darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleFocusModeToggle(!focusMode)}
        aria-label="Toggle focus mode"
        title="Toggle focus mode"
      >
        <Focus className={cn("h-4 w-4", focusMode && "text-blue-600")} />
      </Button>

      {/* Main accessibility menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-1" />
            Accessibility
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Accessibility Settings</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Font Size */}
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Font Size</Label>
              <span className="text-sm text-muted-foreground">{fontSize}%</span>
            </div>
            <div className="flex items-center gap-2">
              <ZoomOut className="h-4 w-4" />
              <Slider
                value={[fontSize]}
                onValueChange={handleFontSizeChange}
                min={50}
                max={150}
                step={10}
                className="flex-1"
                aria-label="Font size adjustment"
              />
              <ZoomIn className="h-4 w-4" />
            </div>
          </div>

          <DropdownMenuSeparator />

          {/* Toggle switches */}
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="high-contrast" className="text-sm cursor-pointer">
                High Contrast
              </Label>
              <Switch
                id="high-contrast"
                checked={highContrast}
                onCheckedChange={handleHighContrastToggle}
                aria-label="Toggle high contrast mode"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="focus-mode" className="text-sm cursor-pointer">
                Focus Mode
              </Label>
              <Switch
                id="focus-mode"
                checked={focusMode}
                onCheckedChange={handleFocusModeToggle}
                aria-label="Toggle focus mode"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="screen-reader" className="text-sm cursor-pointer">
                Screen Reader Support
              </Label>
              <Switch
                id="screen-reader"
                checked={screenReader}
                onCheckedChange={handleScreenReaderToggle}
                aria-label="Toggle screen reader support"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="voice-input" className="text-sm cursor-pointer">
                Voice Input
              </Label>
              <Switch
                id="voice-input"
                checked={voiceInput}
                onCheckedChange={setVoiceInput}
                aria-label="Toggle voice input"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="reduce-motion" className="text-sm cursor-pointer">
                Reduce Motion
              </Label>
              <Switch
                id="reduce-motion"
                checked={reduceMotion}
                onCheckedChange={setReduceMotion}
                aria-label="Toggle reduced motion"
              />
            </div>
          </div>

          <DropdownMenuSeparator />

          {/* Keyboard shortcuts */}
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <div className="w-full">
              <div className="flex items-center gap-2 mb-2">
                <Keyboard className="h-4 w-4" />
                <span className="font-medium text-sm">Keyboard Shortcuts</span>
              </div>
              <div className="space-y-1">
                {keyboardShortcuts.map(shortcut => (
                  <div key={shortcut.key} className="flex justify-between text-xs">
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                      {shortcut.key}
                    </kbd>
                    <span className="text-muted-foreground">{shortcut.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Reset button */}
          <DropdownMenuItem onClick={resetSettings}>
            <Button variant="outline" size="sm" className="w-full">
              Reset to Defaults
            </Button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Screen reader announcements area */}
      <div 
        className="sr-only" 
        role="region" 
        aria-live="polite" 
        aria-label="Screen reader announcements"
      />
    </div>
  )
}