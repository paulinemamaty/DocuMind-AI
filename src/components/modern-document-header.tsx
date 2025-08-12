'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Save,
  Share2,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Grid3x3,
  List,
  Settings,
  Search,
  Cloud,
  CloudOff,
  Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ModernDocumentHeaderProps {
  documentTitle: string
  currentPage: number
  totalPages: number
  zoom: number
  isSaving: boolean
  lastSaved?: Date
  viewMode: 'grid' | 'list' | 'single'
  onPageChange: (page: number) => void
  onZoomChange: (zoom: number) => void
  onRotate: () => void
  onViewModeChange: (mode: 'grid' | 'list' | 'single') => void
  onDownload: () => void
  onSave: () => void
  onShare: () => void
  onSearch: (term: string) => void
}

export function ModernDocumentHeader({
  documentTitle,
  currentPage,
  totalPages,
  zoom,
  isSaving,
  lastSaved,
  viewMode,
  onPageChange,
  onZoomChange,
  onRotate,
  onViewModeChange,
  onDownload,
  onSave,
  onShare,
  onSearch
}: ModernDocumentHeaderProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  // Handle scroll for glassmorphism effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Auto-save indicator
  const getSaveStatus = () => {
    if (isSaving) {
      return (
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600" />
          <span>Saving...</span>
        </div>
      )
    }
    if (lastSaved) {
      const timeDiff = Date.now() - lastSaved.getTime()
      const minutes = Math.floor(timeDiff / 60000)
      const timeText = minutes === 0 ? 'Just now' : `${minutes}m ago`
      return (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <Cloud className="w-4 h-4" />
          <span>Saved {timeText}</span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <CloudOff className="w-4 h-4" />
        <span>Not saved</span>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 h-16 px-4',
          'transition-all duration-300 ease-out',
          'border-b',
          isScrolled ? [
            'bg-white/80 backdrop-blur-xl backdrop-saturate-150',
            'border-gray-200/50 shadow-lg'
          ] : [
            'bg-white/60 backdrop-blur-md',
            'border-gray-200/30'
          ]
        )}
        style={{
          WebkitBackdropFilter: isScrolled ? 'blur(20px)' : 'blur(10px)',
        }}
      >
        <div className="h-full flex items-center justify-between gap-4">
          {/* Left Section: Document Title & Navigation */}
          <div className="flex items-center gap-4 flex-1">
            <FileText className="w-5 h-5 text-blue-600" />
            <div className="flex flex-col">
              <h1 className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">
                {documentTitle}
              </h1>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="h-6 px-2"
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <span className="text-xs text-gray-600 min-w-[60px] text-center">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="h-6 px-2"
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Center Section: Zoom & View Controls */}
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-50/50 rounded-lg backdrop-blur-sm">
            {/* Search */}
            {showSearch ? (
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onSearch(searchTerm)
                    }
                    if (e.key === 'Escape') {
                      setShowSearch(false)
                      setSearchTerm('')
                    }
                  }}
                  className="h-8 w-40"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowSearch(false)
                    setSearchTerm('')
                  }}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSearch(true)}
                    className="h-8 w-8 p-0"
                  >
                    <Search className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Search document</TooltipContent>
              </Tooltip>
            )}

            <div className="w-px h-6 bg-gray-300" />

            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onZoomChange(Math.max(25, zoom - 10))}
                    className="h-8 w-8 p-0"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom out</TooltipContent>
              </Tooltip>

              <div className="flex items-center gap-2 min-w-[120px]">
                <Slider
                  value={[zoom]}
                  onValueChange={([value]) => onZoomChange(value)}
                  min={25}
                  max={200}
                  step={5}
                  className="w-20"
                />
                <span className="text-xs text-gray-600 min-w-[35px]">
                  {zoom}%
                </span>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onZoomChange(Math.min(200, zoom + 10))}
                    className="h-8 w-8 p-0"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom in</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onZoomChange(100)}
                    className="h-8 px-2"
                  >
                    <Maximize2 className="w-3 h-3 mr-1" />
                    <span className="text-xs">Fit</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Fit to page</TooltipContent>
              </Tooltip>
            </div>

            <div className="w-px h-6 bg-gray-300" />

            {/* View Mode */}
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'single' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onViewModeChange('single')}
                    className="h-8 w-8 p-0"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Single page</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onViewModeChange('grid')}
                    className="h-8 w-8 p-0"
                  >
                    <Grid3x3 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Grid view</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onViewModeChange('list')}
                    className="h-8 w-8 p-0"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>List view</TooltipContent>
              </Tooltip>
            </div>

            <div className="w-px h-6 bg-gray-300" />

            {/* Rotate */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRotate}
                  className="h-8 w-8 p-0"
                >
                  <RotateCw className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rotate page</TooltipContent>
            </Tooltip>
          </div>

          {/* Right Section: Save Status & Actions */}
          <div className="flex items-center gap-3 flex-1 justify-end">
            {/* Save Status */}
            {getSaveStatus()}

            <div className="w-px h-6 bg-gray-300" />

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSave}
                    disabled={isSaving}
                    className="h-8 px-3"
                  >
                    <Save className="w-4 h-4 mr-1" />
                    <span className="text-xs">Save</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save document</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDownload}
                    className="h-8 px-3"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    <span className="text-xs">Export</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download document</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onShare}
                    className="h-8 px-3"
                  >
                    <Share2 className="w-4 h-4 mr-1" />
                    <span className="text-xs">Share</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Share document</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Settings className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Print</DropdownMenuItem>
                  <DropdownMenuItem>Document Settings</DropdownMenuItem>
                  <DropdownMenuItem>Version History</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Help & Support</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>
    </TooltipProvider>
  )
}