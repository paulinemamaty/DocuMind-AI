'use client'

import { useState, useCallback } from 'react'
import { 
  Copy, 
  Trash2, 
  Download, 
  Upload,
  Save,
  RefreshCw,
  FileDown,
  FileUp,
  Layers,
  Wand2,
  History,
  FolderOpen
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

interface FormBatchOperationsProps {
  formData: Record<string, any>
  formFields: Array<{
    id: string
    field_name: string
    field_label: string
    field_type: string
    value?: string
  }>
  onUpdateAll: (updates: Record<string, any>) => void
  onClearSection: (fieldIds: string[]) => void
  onImport: (data: Record<string, any>) => void
  onExport: () => void
  documentId: string
}

export function FormBatchOperations({
  formData,
  formFields,
  onUpdateAll,
  onClearSection,
  onImport,
  onExport,
  documentId
}: FormBatchOperationsProps) {
  const [templateName, setTemplateName] = useState('')
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [savedTemplates, setSavedTemplates] = useState<Array<{
    id: string
    name: string
    data: Record<string, any>
    created: Date
  }>>([])
  const { toast } = useToast()

  // Group fields by section (based on field names)
  const groupFieldsBySection = useCallback(() => {
    const sections: Record<string, typeof formFields> = {}
    
    formFields.forEach(field => {
      // Detect section from field name patterns
      let section = 'General'
      const fieldName = field.field_name.toLowerCase()
      
      if (fieldName.includes('name') || fieldName.includes('dob')) {
        section = 'Personal Information'
      } else if (fieldName.includes('address') || fieldName.includes('city') || fieldName.includes('state') || fieldName.includes('zip')) {
        section = 'Address'
      } else if (fieldName.includes('phone') || fieldName.includes('email') || fieldName.includes('fax')) {
        section = 'Contact Information'
      } else if (fieldName.includes('employer') || fieldName.includes('occupation') || fieldName.includes('income')) {
        section = 'Employment'
      } else if (fieldName.includes('ssn') || fieldName.includes('ein') || fieldName.includes('tax')) {
        section = 'Tax Information'
      }
      
      if (!sections[section]) {
        sections[section] = []
      }
      sections[section].push(field)
    })
    
    return sections
  }, [formFields])

  // Fill all similar fields
  const fillSimilarFields = useCallback((fieldName: string, value: string) => {
    const updates: Record<string, any> = {}
    
    // Find all fields with similar names
    formFields.forEach(field => {
      if (field.field_name.toLowerCase().includes(fieldName.toLowerCase()) ||
          field.field_label.toLowerCase().includes(fieldName.toLowerCase())) {
        updates[field.id] = value
      }
    })
    
    onUpdateAll(updates)
    toast({
      title: 'Fields Updated',
      description: `Filled ${Object.keys(updates).length} similar fields`,
    })
  }, [formFields, onUpdateAll, toast])

  // Clear section
  const clearSection = useCallback((section: string) => {
    const sections = groupFieldsBySection()
    const fieldIds = sections[section]?.map(f => f.id) || []
    
    onClearSection(fieldIds)
    toast({
      title: 'Section Cleared',
      description: `Cleared ${fieldIds.length} fields in ${section}`,
    })
  }, [groupFieldsBySection, onClearSection, toast])

  // Save as template
  const saveAsTemplate = useCallback(() => {
    if (!templateName) {
      toast({
        title: 'Error',
        description: 'Please enter a template name',
        variant: 'destructive'
      })
      return
    }

    const template = {
      id: Date.now().toString(),
      name: templateName,
      data: formData,
      created: new Date()
    }

    // Save to localStorage (in production, save to database)
    const templates = JSON.parse(localStorage.getItem('formTemplates') || '[]')
    templates.push(template)
    localStorage.setItem('formTemplates', JSON.stringify(templates))
    
    setSavedTemplates(templates)
    setShowTemplateDialog(false)
    setTemplateName('')
    
    toast({
      title: 'Template Saved',
      description: `Template "${templateName}" saved successfully`,
    })
  }, [templateName, formData, toast])

  // Load template
  const loadTemplate = useCallback((templateId: string) => {
    const templates = JSON.parse(localStorage.getItem('formTemplates') || '[]')
    const template = templates.find((t: any) => t.id === templateId)
    
    if (template) {
      onImport(template.data)
      toast({
        title: 'Template Loaded',
        description: `Loaded template "${template.name}"`,
      })
    }
  }, [onImport, toast])

  // Import from file
  const importFromFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        onImport(data)
        toast({
          title: 'Data Imported',
          description: 'Form data imported successfully',
        })
      } catch (error) {
        toast({
          title: 'Import Failed',
          description: 'Invalid file format',
          variant: 'destructive'
        })
      }
    }
    reader.readAsText(file)
  }, [onImport, toast])

  // Export to file
  const exportToFile = useCallback(() => {
    const dataStr = JSON.stringify(formData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `form-data-${documentId}-${Date.now()}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
    
    toast({
      title: 'Data Exported',
      description: 'Form data exported successfully',
    })
  }, [formData, documentId, toast])

  // Auto-fill with test data
  const autoFillTestData = useCallback(() => {
    const testData: Record<string, any> = {}
    
    formFields.forEach(field => {
      const fieldName = field.field_name.toLowerCase()
      
      if (fieldName.includes('name')) {
        testData[field.id] = 'John Doe'
      } else if (fieldName.includes('email')) {
        testData[field.id] = 'john.doe@example.com'
      } else if (fieldName.includes('phone')) {
        testData[field.id] = '(555) 123-4567'
      } else if (fieldName.includes('address')) {
        testData[field.id] = '123 Main Street'
      } else if (fieldName.includes('city')) {
        testData[field.id] = 'New York'
      } else if (fieldName.includes('state')) {
        testData[field.id] = 'NY'
      } else if (fieldName.includes('zip')) {
        testData[field.id] = '10001'
      } else if (fieldName.includes('date')) {
        testData[field.id] = new Date().toLocaleDateString('en-US')
      } else if (field.field_type === 'checkbox') {
        testData[field.id] = true
      } else {
        testData[field.id] = 'Sample Value'
      }
    })
    
    onUpdateAll(testData)
    toast({
      title: 'Test Data Filled',
      description: 'Form filled with sample test data',
    })
  }, [formFields, onUpdateAll, toast])

  const sections = groupFieldsBySection()

  return (
    <div className="flex items-center gap-2">
      {/* Fill Similar Fields */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Copy className="h-4 w-4 mr-1" />
            Fill Similar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Fill all similar fields</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {Array.from(new Set(formFields.map(f => f.field_name))).slice(0, 5).map(fieldName => (
            <DropdownMenuItem
              key={fieldName}
              onClick={() => {
                const value = formData[formFields.find(f => f.field_name === fieldName)?.id || '']
                if (value) {
                  fillSimilarFields(fieldName, value)
                }
              }}
            >
              <Layers className="h-4 w-4 mr-2" />
              {fieldName}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear Section */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Trash2 className="h-4 w-4 mr-1" />
            Clear Section
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Clear form sections</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {Object.keys(sections).map(section => (
            <DropdownMenuItem
              key={section}
              onClick={() => clearSection(section)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {section} ({sections[section].length} fields)
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onClearSection(formFields.map(f => f.id))}
            className="text-red-600"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All Fields
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Templates */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <FolderOpen className="h-4 w-4 mr-1" />
            Templates
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Form Templates</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
            <DialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Save className="h-4 w-4 mr-2" />
                Save as Template
              </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Form as Template</DialogTitle>
                <DialogDescription>
                  Save the current form data as a reusable template
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., W-9 Form Template"
                  />
                </div>
                <Button onClick={saveAsTemplate} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  Save Template
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <DropdownMenuSeparator />
          
          {savedTemplates.length > 0 ? (
            savedTemplates.map(template => (
              <DropdownMenuItem
                key={template.id}
                onClick={() => loadTemplate(template.id)}
              >
                <History className="h-4 w-4 mr-2" />
                {template.name}
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>
              No saved templates
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Import/Export */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <FileDown className="h-4 w-4 mr-1" />
            Import/Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Data Operations</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={exportToFile}>
            <Download className="h-4 w-4 mr-2" />
            Export to JSON
          </DropdownMenuItem>
          
          <DropdownMenuItem asChild>
            <label className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              Import from JSON
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={importFromFile}
              />
            </label>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={autoFillTestData}>
            <Wand2 className="h-4 w-4 mr-2" />
            Auto-fill Test Data
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}