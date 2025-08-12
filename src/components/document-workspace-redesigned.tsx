'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { EnhancedFormDetector, FieldType, FIELD_ICONS, type EnhancedFormField, type FieldGroup } from '@/services/enhanced-form-detector'
import { PDFViewer } from './pdf/pdf-viewer-wrapper'
import { PDFFieldOverlay } from './pdf-field-overlay'
import { cn } from '@/lib/utils'
import {
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Save,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Grid3x3,
  List,
  Eye,
  EyeOff,
  Sparkles,
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  CreditCard,
  Lock,
  Building,
  Briefcase,
  DollarSign,
  FileSignature,
  Hash,
  Type,
  CheckSquare,
  Circle,
  Square,
  PenTool,
  Layers,
  Copy,
  ClipboardCopy,
  RefreshCw,
  Info,
  X,
  Menu,
  ChevronDown,
  ChevronUp,
  Clock,
  Shield,
  Zap,
  Target,
  TrendingUp,
  Send
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface DocumentWorkspaceRedesignedProps {
  documentId: string
}

// Professional color scheme
const colors = {
  primary: '#0066CC',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  background: '#F9FAFB',
  surface: '#FFFFFF',
  text: {
    primary: '#111827',
    secondary: '#6B7280',
    muted: '#9CA3AF'
  }
}

// Get icon component for field type
const getFieldIcon = (fieldType: FieldType) => {
  const iconMap: Record<FieldType, any> = {
    [FieldType.TEXT]: Type,
    [FieldType.EMAIL]: Mail,
    [FieldType.PHONE]: Phone,
    [FieldType.DATE]: Calendar,
    [FieldType.SSN]: Shield,
    [FieldType.ZIP]: MapPin,
    [FieldType.NUMBER]: Hash,
    [FieldType.CURRENCY]: DollarSign,
    [FieldType.CHECKBOX]: CheckSquare,
    [FieldType.RADIO]: Circle,
    [FieldType.SIGNATURE]: PenTool,
    [FieldType.ADDRESS]: Building,
    [FieldType.SELECT]: ChevronDown,
    [FieldType.TEXTAREA]: FileText
  }
  return iconMap[fieldType] || Type
}

export function DocumentWorkspaceRedesigned({ documentId }: DocumentWorkspaceRedesignedProps) {
  const { toast } = useToast()
  // State management
  const [document, setDocument] = useState<any>(null)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [debugInfo, setDebugInfo] = useState<{
    documentId: string
    storageUrl?: string
    error?: string
    supabaseResponse?: any
    fileExists?: boolean
    apiTestResult?: string
    showDebug?: boolean
  }>({ documentId, showDebug: false })
  
  // Form fields state
  const [formFields, setFormFields] = useState<EnhancedFormField[]>([])
  const [fieldGroups, setFieldGroups] = useState<FieldGroup[]>([])
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  
  // UI state
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showFieldOverlay, setShowFieldOverlay] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState('fields')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatSessionId, setChatSessionId] = useState<string | null>(null)
  const [contextualHelp, setContextualHelp] = useState<string | null>(null)
  
  // Quick Actions state
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [autoFillProgress, setAutoFillProgress] = useState(0)
  const [isAutoFilling, setIsAutoFilling] = useState(false)
  
  // Refs
  const documentViewerRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const formDetector = EnhancedFormDetector.getInstance()

  useEffect(() => {
    fetchDocument()
  }, [documentId])
  
  // Auto-scroll to latest chat message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const refreshDocumentUrl = async () => {
    if (!document?.file_url) return
    
    try {
      const { data: signedUrlData, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.file_url, 86400) // 24 hour expiry
      
      if (!error && signedUrlData?.signedUrl) {
        console.log('✅ Refreshed signed URL')
        setDocumentUrl(signedUrlData.signedUrl)
      } else {
        // Fall back to API endpoint
        const pdfUrl = `/api/documents/${documentId}/pdf`
        setDocumentUrl(pdfUrl)
      }
    } catch (error) {
      console.error('Failed to refresh URL:', error)
      const pdfUrl = `/api/documents/${documentId}/pdf`
      setDocumentUrl(pdfUrl)
    }
  }

  const fetchDocument = async () => {
    try {
      setLoading(true)
      console.log('\n=====================================');
      console.log('  DOCUMENT LOADING DEBUG')
      console.log('=====================================\n');
      console.log('📊 STEP 1: Checking Database Record')
      console.log('-------------------------------------');
      console.log('🔍 Document ID:', documentId)
      setDebugInfo(prev => ({ ...prev, documentId }))
      
      // STEP 1: Verify document record exists
      const { data: doc, error } = await supabase
        .from('documents')
        .select(`
          *,
          document_form_fields (
            id,
            field_name,
            field_label,
            field_type,
            field_value,
            confidence,
            coordinates,
            page_number,
            metadata
          )
        `)
        .eq('id', documentId)
        .single()

      if (error) {
        console.error('❌ Database Error:', error.message)
        setDebugInfo(prev => ({ ...prev, error: error.message }))
        throw error
      }
      
      if (!doc) {
        console.error('❌ Document not found in database')
        setDebugInfo(prev => ({ ...prev, error: 'Document not found' }))
        throw new Error('Document not found')
      }
      
      console.log('✅ Document found in database:');
      console.log('   ID:', doc.id);
      console.log('   Filename:', doc.filename);
      console.log('   File URL/Path:', doc.file_url);
      console.log('   Status:', doc.status);
      console.log('   MIME Type:', doc.mime_type);
      console.log('   File Size:', doc.file_size, 'bytes');
      console.log('   Created:', doc.created_at);
      
      // Check column names
      console.log('\n📋 Column Check:');
      console.log('   Has "status":', doc.hasOwnProperty('status') ? '✅' : '❌');
      console.log('   Has "processing_status":', doc.hasOwnProperty('processing_status') ? '⚠️ OLD COLUMN' : '✅ Correct');
      
      setDocument(doc)
      setDebugInfo(prev => ({ ...prev, supabaseResponse: doc }))

      // Process form fields with enhanced detection
      if (doc.document_form_fields && doc.document_form_fields.length > 0) {
        const enhanced = await formDetector.enhanceFormFields(documentId, doc.document_form_fields)
        setFormFields(enhanced)
        
        // Group fields
        const groups = formDetector.groupFields(enhanced)
        setFieldGroups(groups)
        
        // Load saved form data
        const savedData: Record<string, any> = {}
        doc.document_form_fields.forEach((field: any) => {
          if (field.field_value) {
            savedData[field.id] = field.field_value
          }
        })
        setFormData(savedData)
      } else {
        // No fields detected, run detection
        console.log('No fields detected, running Document AI detection...')
        await runFieldDetection()
      }

      // STEP 2: Check if file exists in storage and generate URL
      if (doc.file_url) {
        console.log('\n📦 STEP 2: Checking Storage');
        console.log('-------------------------------------');
        console.log('   Storage path:', doc.file_url);
        
        try {
          // First, try to download the file to verify it exists
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('documents')
            .download(doc.file_url);
          
          if (downloadError) {
            console.error('❌ Storage Error:', downloadError.message);
            console.log('\n🔍 Attempting to list files in bucket...');
            
            // List files to debug
            const pathParts = doc.file_url.split('/');
            const folder = pathParts.slice(0, -1).join('/');
            
            const { data: files, error: listError } = await supabase.storage
              .from('documents')
              .list(folder, {
                limit: 10,
                offset: 0
              });
            
            if (listError) {
              console.error('   Cannot list files:', listError.message);
            } else if (files) {
              console.log('   Files in folder:', files.map(f => f.name).join(', '));
            }
            
            // Fall back to API endpoint
            const pdfUrl = `/api/documents/${documentId}/pdf`
            console.log('🔗 Falling back to API endpoint:', pdfUrl)
            setDocumentUrl(pdfUrl)
            setDebugInfo(prev => ({ 
              ...prev, 
              storageUrl: doc.file_url,
              fileExists: false,
              error: `Storage error: ${downloadError.message}`
            }))
          } else if (fileData) {
            console.log('✅ File exists in storage!');
            console.log('   File size:', fileData.size, 'bytes');
            console.log('   File type:', fileData.type);
            setDebugInfo(prev => ({ ...prev, fileExists: true }))
            
            // STEP 3: Generate signed URL for viewing
            console.log('\n🔗 STEP 3: Generating Access URLs');
            console.log('-------------------------------------');
            
            const { data: signedUrlData, error: signedError } = await supabase.storage
              .from('documents')
              .createSignedUrl(doc.file_url, 3600); // 1 hour expiry
            
            if (signedError) {
              console.error('❌ Signed URL Error:', signedError.message);
              // Fall back to API endpoint
              const pdfUrl = `/api/documents/${documentId}/pdf`
              console.log('🔗 Falling back to API endpoint:', pdfUrl)
              setDocumentUrl(pdfUrl)
            } else if (signedUrlData?.signedUrl) {
              console.log('✅ Signed URL generated successfully');
              console.log('   URL:', signedUrlData.signedUrl.substring(0, 100) + '...');
              console.log('   Expires in: 1 hour');
              
              // Test if URL is accessible
              try {
                const response = await fetch(signedUrlData.signedUrl, { method: 'HEAD' });
                console.log('   URL accessibility:', response.ok ? '✅ Accessible' : '❌ Not accessible');
                console.log('   HTTP Status:', response.status);
                
                if (response.ok) {
                  setDocumentUrl(signedUrlData.signedUrl)
                  setDebugInfo(prev => ({ 
                    ...prev, 
                    storageUrl: doc.file_url,
                    apiTestResult: `Signed URL working (HTTP ${response.status})`
                  }))
                } else {
                  // Fall back to API endpoint
                  const pdfUrl = `/api/documents/${documentId}/pdf`
                  console.log('🔗 URL not accessible, falling back to API endpoint:', pdfUrl)
                  setDocumentUrl(pdfUrl)
                }
              } catch (fetchError) {
                console.error('   URL test failed:', fetchError);
                // Fall back to API endpoint
                const pdfUrl = `/api/documents/${documentId}/pdf`
                console.log('🔗 Falling back to API endpoint:', pdfUrl)
                setDocumentUrl(pdfUrl)
              }
            }
          }
        } catch (storageError) {
          console.error('🚨 Unexpected error:', storageError)
          // Fall back to API endpoint
          const pdfUrl = `/api/documents/${documentId}/pdf`
          console.log('🔗 Falling back to API endpoint:', pdfUrl)
          setDocumentUrl(pdfUrl)
        }
        
        // STEP 4: Display recommendations
        console.log('\n💡 RECOMMENDATIONS');
        console.log('-------------------------------------');
        console.log('1. Document record exists ✅');
        console.log('2. File path is:', doc.file_url);
        console.log('3. To display PDF:');
        console.log('   a) Use signed URL for private bucket');
        console.log('   b) Pass URL to react-pdf Document component');
        console.log('   c) Ensure PDF.js worker is loaded');
        console.log('\n4. Document AI is NOT needed for basic viewing');
        console.log('   - It\'s only for field detection/extraction');
        console.log('   - PDF should display without it');
        console.log('\n=====================================\n');
      } else {
        console.warn('⚠️ No file URL found for document:', documentId)
        setDebugInfo(prev => ({ ...prev, error: 'No file URL in database' }))
        toast({
          title: 'Document Error',
          description: 'No file URL found in database record',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('💥 Error fetching document:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setDebugInfo(prev => ({ ...prev, error: errorMessage }))
      toast({
        title: 'Failed to load document',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const testDocumentAPI = async () => {
    console.log('🧪 Testing document API...')
    try {
      // Test the PDF API endpoint directly
      const response = await fetch(`/api/documents/${documentId}/pdf`)
      console.log('📡 API Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      })
      
      if (response.ok) {
        const blob = await response.blob()
        console.log('✅ PDF loaded successfully, size:', blob.size)
        setDebugInfo(prev => ({ 
          ...prev, 
          apiTestResult: `Success: PDF size ${blob.size} bytes` 
        }))
      } else {
        const error = await response.text()
        console.error('❌ API Error:', error)
        setDebugInfo(prev => ({ 
          ...prev, 
          apiTestResult: `Error ${response.status}: ${error}` 
        }))
      }
    } catch (err) {
      console.error('💥 Test failed:', err)
      setDebugInfo(prev => ({ 
        ...prev, 
        apiTestResult: `Test failed: ${err}` 
      }))
    }
  }

  const runFieldDetection = async () => {
    try {
      setSaving(true)
      toast({
        title: 'Detecting Fields',
        description: 'Analyzing document structure...',
      })
      
      const response = await fetch('/api/documents/detect-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId })
      })

      const result = await response.json()
      
      if (response.ok) {
        toast({
          title: 'Fields Detected',
          description: result.message,
        })
        // Refetch document with fields
        await fetchDocument()
      } else {
        toast({
          title: 'Detection Failed',
          description: result.error || 'Could not detect form fields',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error running field detection:', error)
      toast({
        title: 'Detection Error',
        description: 'Failed to detect form fields',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }))
    
    // Clear error when user starts typing
    if (fieldErrors[fieldId]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldId]
        return newErrors
      })
    }
  }

  // Handle field selection for contextual help
  const handleFieldSelect = async (fieldId: string) => {
    setSelectedField(fieldId)
    const field = formFields.find(f => f.id === fieldId)
    if (field) {
      // Get contextual help for the field
      await getFieldContextualHelp(field)
    }
  }

  // Get contextual help for a field
  const getFieldContextualHelp = async (field: EnhancedFormField) => {
    try {
      const response = await fetch('/api/ai/field-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldName: field.field_name,
          fieldLabel: field.field_label,
          fieldType: field.field_type,
          currentValue: formData[field.id] || ''
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setContextualHelp(data.suggestion)
      }
    } catch (error) {
      console.error('Error getting field help:', error)
    }
  }

  // Handle chat submission
  const handleChatSubmit = async () => {
    if (!chatInput.trim() || chatLoading) return
    
    const userMessage = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setChatLoading(true)
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          message: userMessage,
          sessionId: chatSessionId
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }])
        if (!chatSessionId) {
          setChatSessionId(data.sessionId)
        }
      } else {
        setChatMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Sorry, I encountered an error. Please try again.' 
        }])
      }
    } catch (error) {
      console.error('Chat error:', error)
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }])
    } finally {
      setChatLoading(false)
    }
  }

  const validateField = (field: EnhancedFormField, value: string): boolean => {
    if (field.required && !value) {
      setFieldErrors(prev => ({ ...prev, [field.id]: 'This field is required' }))
      return false
    }
    
    if (field.validation_pattern && value) {
      const pattern = new RegExp(field.validation_pattern)
      if (!pattern.test(value)) {
        setFieldErrors(prev => ({ ...prev, [field.id]: `Invalid ${field.field_type} format` }))
        return false
      }
    }
    
    return true
  }

  const saveFormData = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Validate all required fields
      let hasErrors = false
      formFields.forEach(field => {
        if (!validateField(field, formData[field.id] || '')) {
          hasErrors = true
        }
      })
      
      if (hasErrors) {
        setSaving(false)
        return
      }

      // Save to database
      const updates = formFields.map(field => ({
        document_id: documentId,
        field_id: field.id,
        value: formData[field.id] || '',
        user_id: user.id
      }))

      await supabase
        .from('document_filled_data')
        .upsert(updates, { onConflict: 'document_id,field_id,user_id' })

      // Save version for history tracking
      const versionData = {
        document_id: documentId,
        user_id: user.id,
        version_number: Date.now(),
        changes: JSON.stringify(formData),
        created_at: new Date().toISOString()
      }

      await supabase
        .from('document_versions')
        .insert(versionData)

      // Show success message
      console.log('Form saved successfully')
    } catch (error) {
      console.error('Error saving form:', error)
    } finally {
      setSaving(false)
    }
  }

  const copyFieldValue = (fieldId: string) => {
    const value = formData[fieldId]
    if (value) {
      navigator.clipboard.writeText(value)
    }
  }

  // Quick Actions handlers
  const handleAutoFill = async () => {
    setIsAutoFilling(true)
    setAutoFillProgress(0)
    
    try {
      // Get user profile data
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      const totalFields = formFields.length
      let filledCount = 0
      const updates: Record<string, string> = {}
      
      // Smart field detection and auto-fill
      for (const field of formFields) {
        // Skip if already filled
        if (formData[field.id]) {
          filledCount++
          setAutoFillProgress((filledCount / totalFields) * 100)
          continue
        }
        
        let value = ''
        
        // Try to match with user profile
        if (profile) {
          if (field.field_type === FieldType.EMAIL || field.field_name.toLowerCase().includes('email')) {
            value = profile.email || user.email || ''
          } else if (field.field_type === FieldType.PHONE || field.field_name.toLowerCase().includes('phone')) {
            value = profile.phone || ''
          } else if (field.field_name.toLowerCase().includes('first') && field.field_name.toLowerCase().includes('name')) {
            value = profile.first_name || ''
          } else if (field.field_name.toLowerCase().includes('last') && field.field_name.toLowerCase().includes('name')) {
            value = profile.last_name || ''
          } else if (field.field_type === FieldType.ADDRESS || field.field_name.toLowerCase().includes('address')) {
            value = profile.address || ''
          } else if (field.field_name.toLowerCase().includes('city')) {
            value = profile.city || ''
          } else if (field.field_name.toLowerCase().includes('state')) {
            value = profile.state || ''
          } else if (field.field_type === FieldType.ZIP || field.field_name.toLowerCase().includes('zip')) {
            value = profile.zip_code || ''
          }
        }
        
        // Use smart defaults for common fields
        if (!value) {
          if (field.field_type === FieldType.DATE && field.field_name.toLowerCase().includes('today')) {
            value = new Date().toISOString().split('T')[0]
          } else if (field.field_type === FieldType.CHECKBOX) {
            value = 'false'
          }
        }
        
        if (value) {
          updates[field.id] = value
        }
        
        filledCount++
        setAutoFillProgress((filledCount / totalFields) * 100)
        
        // Add small delay for visual feedback
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      
      // Apply all updates
      setFormData(prev => ({ ...prev, ...updates }))
      
      toast({
        title: 'Auto-fill Complete',
        description: `Filled ${Object.keys(updates).length} fields from your profile`,
      })
    } catch (error) {
      console.error('Auto-fill error:', error)
      toast({
        title: 'Auto-fill Failed',
        description: 'Could not auto-fill fields. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsAutoFilling(false)
      setAutoFillProgress(0)
    }
  }
  
  const handleCopyAddress = async () => {
    try {
      // Find billing address fields
      const billingFields = formFields.filter(f => 
        f.group?.toLowerCase().includes('billing') ||
        (f.field_name.toLowerCase().includes('billing') && 
         (f.field_type === FieldType.ADDRESS || 
          f.field_name.toLowerCase().includes('address') ||
          f.field_name.toLowerCase().includes('city') ||
          f.field_name.toLowerCase().includes('state') ||
          f.field_name.toLowerCase().includes('zip')))
      )
      
      // Find shipping address fields
      const shippingFields = formFields.filter(f => 
        f.group?.toLowerCase().includes('shipping') ||
        (f.field_name.toLowerCase().includes('shipping') && 
         (f.field_type === FieldType.ADDRESS || 
          f.field_name.toLowerCase().includes('address') ||
          f.field_name.toLowerCase().includes('city') ||
          f.field_name.toLowerCase().includes('state') ||
          f.field_name.toLowerCase().includes('zip')))
      )
      
      if (billingFields.length > 0 && shippingFields.length > 0) {
        // Copy billing to shipping
        const updates: Record<string, string> = {}
        
        billingFields.forEach(billingField => {
          const billingValue = formData[billingField.id]
          if (billingValue) {
            // Find corresponding shipping field
            const shippingField = shippingFields.find(sf => 
              sf.field_type === billingField.field_type ||
              sf.field_name.toLowerCase().includes(
                billingField.field_name.toLowerCase().replace('billing', '').replace('_', '')
              )
            )
            
            if (shippingField) {
              updates[shippingField.id] = billingValue
            }
          }
        })
        
        if (Object.keys(updates).length > 0) {
          setFormData(prev => ({ ...prev, ...updates }))
          toast({
            title: 'Address Copied',
            description: 'Billing address copied to shipping address',
          })
        } else {
          toast({
            title: 'No Address to Copy',
            description: 'Please fill in the billing address first',
          })
        }
      } else {
        // Fallback: Copy any address field to clipboard
        const addressFields = formFields.filter(f => 
          f.field_type === FieldType.ADDRESS || 
          f.field_name.toLowerCase().includes('address')
        )
        
        if (addressFields.length > 0) {
          const addressData = addressFields
            .map(f => formData[f.id])
            .filter(Boolean)
            .join(', ')
          
          if (addressData) {
            await navigator.clipboard.writeText(addressData)
            toast({
              title: 'Address Copied',
              description: 'Address copied to clipboard',
            })
          } else {
            toast({
              title: 'No Address Found',
              description: 'Please fill in an address field first',
            })
          }
        }
      }
    } catch (error) {
      console.error('Copy address error:', error)
      toast({
        title: 'Copy Failed',
        description: 'Could not copy address. Please try again.',
      })
    }
  }
  
  const handleClearAll = () => {
    setShowClearDialog(true)
  }
  
  const confirmClearAll = () => {
    setFormData({})
    setFieldErrors({})
    setShowClearDialog(false)
    toast({
      title: 'Fields Cleared',
      description: 'All form fields have been cleared',
    })
  }
  
  const handleExport = async () => {
    try {
      // Save form data first
      await saveFormData()
      
      // Create a download link for the PDF
      const response = await fetch(`/api/documents/${documentId}/pdf`)
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${document?.filename?.replace('.pdf', '') || 'document'}_filled.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        toast({
          title: 'Export Complete',
          description: 'Your filled document has been downloaded',
        })
      } else {
        // Fallback to simple download
        window.open(`/api/documents/${documentId}/pdf`, '_blank')
      }
    } catch (error) {
      console.error('Export error:', error)
      toast({
        title: 'Export Failed',
        description: 'Could not export the document. Please try again.',
      })
    }
  }

  const fillSimilarFields = (sourceFieldId: string) => {
    const sourceField = formFields.find(f => f.id === sourceFieldId)
    if (!sourceField || !formData[sourceFieldId]) return

    const updates: Record<string, any> = {}
    
    // Find similar fields
    formFields.forEach(field => {
      if (field.id !== sourceFieldId && field.field_type === sourceField.field_type) {
        if (field.field_name.toLowerCase().includes(sourceField.field_name.toLowerCase()) ||
            sourceField.field_name.toLowerCase().includes(field.field_name.toLowerCase())) {
          updates[field.id] = formData[sourceFieldId]
        }
      }
    })
    
    setFormData(prev => ({ ...prev, ...updates }))
  }

  const renderFieldInput = (field: EnhancedFormField) => {
    const value = formData[field.id] || ''
    const error = fieldErrors[field.id]
    const FieldIcon = getFieldIcon(field.field_type)
    
    const inputClassName = cn(
      "w-full transition-all duration-200",
      error && "border-red-500 focus:ring-red-500",
      field.confidence < 0.7 && "border-yellow-500"
    )

    switch (field.field_type) {
      case FieldType.CHECKBOX:
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={value === 'true' || value === true}
              onCheckedChange={(checked) => handleFieldChange(field.id, checked)}
              className={error ? 'border-red-500' : ''}
            />
            <Label htmlFor={field.id} className="text-sm font-normal">
              {field.field_label}
            </Label>
          </div>
        )
      
      case FieldType.TEXTAREA:
        return (
          <Textarea
            id={field.id}
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={inputClassName}
            rows={3}
          />
        )
      
      case FieldType.SELECT:
        return (
          <Select value={value} onValueChange={(v) => handleFieldChange(field.id, v)}>
            <SelectTrigger className={inputClassName}>
              <SelectValue placeholder={field.placeholder || 'Select an option'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="option1">Option 1</SelectItem>
              <SelectItem value="option2">Option 2</SelectItem>
              <SelectItem value="option3">Option 3</SelectItem>
            </SelectContent>
          </Select>
        )
      
      case FieldType.DATE:
        return (
          <Input
            type="date"
            id={field.id}
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className={inputClassName}
          />
        )
      
      case FieldType.SIGNATURE:
        return (
          <div className={cn(
            "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors",
            error && "border-red-500",
            value && "border-green-500 bg-green-50"
          )}>
            {value ? (
              <div className="text-green-600">
                <FileSignature className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Signature captured</p>
              </div>
            ) : (
              <div className="text-gray-400">
                <PenTool className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Click to add signature</p>
              </div>
            )}
          </div>
        )
      
      default:
        return (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FieldIcon className="h-4 w-4 text-gray-400" />
            </div>
            <Input
              type={field.field_type === FieldType.EMAIL ? 'email' : 
                    field.field_type === FieldType.PHONE ? 'tel' :
                    field.field_type === FieldType.NUMBER ? 'number' : 'text'}
              id={field.id}
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              className={cn(inputClassName, "pl-10")}
            />
            {field.confidence < 0.7 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-yellow-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Low confidence: {Math.round(field.confidence * 100)}%</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="relative">
            <div className="h-16 w-16 border-4 border-blue-200 rounded-full animate-pulse mx-auto"></div>
            <div className="h-16 w-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-1/2 -translate-x-1/2"></div>
          </div>
          <p className="mt-4 text-gray-600 font-medium">Loading document...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Clear All Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Fields?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all form field values. The field detection will remain intact.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClearAll}>
              Clear All Fields
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="h-screen flex flex-col bg-gray-50">
      {/* Modern Header with Glassmorphism */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left Section */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
              className="lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <h1 className="font-semibold text-sm">{document?.filename}</h1>
                <p className="text-xs text-gray-500">
                  {formFields.length} fields • {fieldGroups.length} sections
                </p>
              </div>
            </div>
          </div>

          {/* Center Section - Zoom & View Controls */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(Math.max(50, zoom - 10))}
              className="h-8 px-2"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium w-12 text-center">{zoom}%</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(Math.min(200, zoom + 10))}
              className="h-8 px-2"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRotation((rotation + 90) % 360)}
              className="h-8 px-2"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Button
              variant={showFieldOverlay ? "default" : "ghost"}
              size="sm"
              onClick={() => setShowFieldOverlay(!showFieldOverlay)}
              className="h-8 px-2"
            >
              {showFieldOverlay ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          </div>

          {/* Right Section - Actions */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              Auto-saved
            </Badge>
            <Button
              variant="default"
              size="sm"
              onClick={saveFormData}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save All
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
            >
              <Sparkles className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Form Completion</span>
            <span>{Math.round((Object.keys(formData).length / formFields.length) * 100)}%</span>
          </div>
          <Progress 
            value={(Object.keys(formData).length / formFields.length) * 100} 
            className="h-1.5"
          />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className={cn(
          "w-64 bg-white border-r border-gray-200 flex flex-col transition-all duration-300",
          !leftSidebarOpen && "-ml-64"
        )}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 p-1 m-2">
              <TabsTrigger value="fields" className="text-xs">Fields</TabsTrigger>
              <TabsTrigger value="pages" className="text-xs">Pages</TabsTrigger>
            </TabsList>
            
            <TabsContent value="fields" className="flex-1 overflow-hidden m-0">
              <div className="p-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search fields..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
              
              <ScrollArea className="flex-1 px-2">
                <div className="space-y-4 pb-4">
                  {fieldGroups.length === 0 ? (
                    <div className="text-center py-8">
                      <Sparkles className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-600 mb-4">No fields detected yet</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={runFieldDetection}
                        disabled={saving}
                        className="w-full mx-2"
                      >
                        {saving ? (
                          <>
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                            Detecting Fields...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 mr-1" />
                            Detect Form Fields
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                  fieldGroups.map((group) => (
                    <div key={group.name} className="space-y-2">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{group.icon}</span>
                          <h3 className="font-medium text-sm">{group.name}</h3>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {Math.round(group.completion_percentage)}%
                        </Badge>
                      </div>
                      
                      <div className="space-y-1">
                        {group.fields
                          .filter(field => 
                            field.field_label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            field.field_name.toLowerCase().includes(searchTerm.toLowerCase())
                          )
                          .map((field) => (
                            <button
                              key={field.id}
                              onClick={() => {
                                handleFieldSelect(field.id)
                                setCurrentPage(field.coordinates?.page || 1)
                              }}
                              className={cn(
                                "w-full text-left px-3 py-2 rounded-lg transition-colors",
                                "hover:bg-gray-100",
                                selectedField === field.id && "bg-blue-50 border-blue-200",
                                formData[field.id] && "border-l-4 border-green-500"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="text-sm">{field.icon}</span>
                                  <span className="text-sm truncate">{field.field_label}</span>
                                </div>
                                {formData[field.id] && (
                                  <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                                )}
                              </div>
                            </button>
                          ))}
                      </div>
                    </div>
                  ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="pages" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="flex-1 p-2">
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "aspect-[3/4] border-2 rounded-lg p-2 transition-all",
                        currentPage === page ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <div className="text-xs text-gray-500 mb-1">Page {page}</div>
                      <div className="bg-gray-100 rounded h-full"></div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </aside>

        {/* Document Viewer */}
        <div className="flex-1 bg-gray-100 relative overflow-hidden" ref={documentViewerRef}>
          {/* Debug Panel */}
          {debugInfo.showDebug && (
            <div className="absolute top-0 left-0 right-0 z-50 bg-yellow-50 border-b-2 border-yellow-300 p-4 max-h-64 overflow-auto">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-yellow-900">🔍 Debug Information</h3>
                <button
                  onClick={() => setDebugInfo(prev => ({ ...prev, showDebug: false }))}
                  className="text-yellow-900 hover:bg-yellow-100 p-1 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div><strong>Document ID:</strong> {debugInfo.documentId}</div>
                <div><strong>Storage URL:</strong> {debugInfo.storageUrl || 'Not set'}</div>
                <div><strong>File Exists:</strong> {debugInfo.fileExists === undefined ? 'Unknown' : debugInfo.fileExists ? '✅ Yes' : '❌ No'}</div>
                <div><strong>API Test Result:</strong> {debugInfo.apiTestResult || 'Not tested'}</div>
                <div><strong>Error:</strong> <span className="text-red-600">{debugInfo.error || 'None'}</span></div>
                {debugInfo.supabaseResponse && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-yellow-900">Supabase Response</summary>
                    <pre className="mt-1 p-2 bg-white rounded text-xs overflow-auto max-h-32">
                      {JSON.stringify(debugInfo.supabaseResponse, null, 2)}
                    </pre>
                  </details>
                )}
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={testDocumentAPI}
                    className="text-xs"
                  >
                    Test PDF API
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={fetchDocument}
                    className="text-xs"
                  >
                    Retry Fetch
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* Debug Toggle Button */}
          <button
            onClick={() => setDebugInfo(prev => ({ ...prev, showDebug: !prev.showDebug }))}
            className="absolute top-2 right-2 z-40 bg-yellow-100 hover:bg-yellow-200 text-yellow-900 px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
          >
            <Info className="h-3 w-3" />
            Debug
          </button>
          
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="h-10 w-10 animate-spin text-blue-600" />
                <p className="text-sm text-gray-600 font-medium">Loading document...</p>
              </div>
            </div>
          ) : documentUrl ? (
            <div className="absolute inset-0">
              <PDFViewer
                url={documentUrl}
                initialPage={currentPage}
                initialZoom={zoom / 100}
                onPageChange={setCurrentPage}
                onLoadSuccess={(numPages: number) => setTotalPages(numPages)}
                onLoadError={(error: Error) => {
                  if (error.message === 'URL_REFRESH_NEEDED') {
                    refreshDocumentUrl()
                  } else {
                    console.error('PDF load error:', error)
                    toast({
                      title: 'Failed to load PDF',
                      description: error.message,
                      variant: 'destructive'
                    })
                  }
                }}
                showControls={false}
              />
              
              {/* Field Overlay */}
              {showFieldOverlay && formFields.length > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  {formFields.map(field => (
                    <PDFFieldOverlay
                      key={field.id}
                      field={field}
                      value={formData[field.id] || ''}
                      scale={zoom / 100}
                      pageNumber={field.page_number || 1}
                      currentPage={currentPage}
                      onFieldChange={handleFieldChange}
                      onFieldFocus={handleFieldSelect}
                      onFieldBlur={() => setSelectedField(null)}
                      isSelected={selectedField === field.id}
                      pdfContainerRef={documentViewerRef}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-6">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 text-lg font-medium">No document available</p>
                <p className="text-gray-500 text-sm mt-2">The document could not be loaded</p>
              </div>
            </div>
          )}

          {/* Page Navigation */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg px-4 py-2 flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Right Sidebar - Form Fields */}
        <aside className={cn(
          "w-96 bg-white border-l border-gray-200 flex flex-col transition-all duration-300",
          !rightSidebarOpen && "-mr-96"
        )}>
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Form Assistant</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                >
                  {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid3x3 className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRightSidebarOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {/* Chat Messages */}
              {chatMessages.length > 0 && (
                <Card className="p-4 max-h-64 overflow-y-auto">
                  <div className="space-y-3">
                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className={cn(
                        "flex gap-2",
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      )}>
                        <div className={cn(
                          "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                          msg.role === 'user' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-800'
                        )}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                </Card>
              )}

              {/* Contextual Help */}
              {contextualHelp && selectedField && (
                <Card className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-medium text-sm mb-1">AI Suggestion</h3>
                      <p className="text-xs text-gray-600">{contextualHelp}</p>
                    </div>
                  </div>
                </Card>
              )}
              
              {/* Quick Actions */}
              <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                <h3 className="font-medium text-sm mb-3">Quick Actions</h3>
                {isAutoFilling && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Auto-filling fields...</span>
                      <span>{Math.round(autoFillProgress)}%</span>
                    </div>
                    <Progress value={autoFillProgress} className="h-2" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="justify-start"
                    onClick={handleAutoFill}
                    disabled={isAutoFilling}
                  >
                    {isAutoFilling ? (
                      <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Filling...</>
                    ) : (
                      <><Zap className="h-4 w-4 mr-2" /> Auto-fill</>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="justify-start"
                    onClick={handleCopyAddress}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Address
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="justify-start"
                    onClick={handleClearAll}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="justify-start"
                    onClick={handleExport}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </Card>

              {/* Selected Field Detail */}
              {selectedField && (
                <Card className="p-4 border-blue-200 bg-blue-50/50">
                  {(() => {
                    const field = formFields.find(f => f.id === selectedField)
                    if (!field) return null
                    
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2">
                            <span>{field.icon}</span>
                            {field.field_label}
                            {field.required && <span className="text-red-500">*</span>}
                          </Label>
                          <div className="flex items-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <Info className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{field.help_text}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => copyFieldValue(field.id)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => fillSimilarFields(field.id)}
                            >
                              <ClipboardCopy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        
                        {renderFieldInput(field)}
                        
                        {fieldErrors[field.id] && (
                          <p className="text-xs text-red-500 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {fieldErrors[field.id]}
                          </p>
                        )}
                        
                        {field.confidence < 0.7 && (
                          <div className="text-xs text-yellow-600 bg-yellow-50 rounded p-2">
                            <Target className="h-3 w-3 inline mr-1" />
                            Low confidence detection ({Math.round(field.confidence * 100)}%)
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </Card>
              )}

              {/* All Fields */}
              <div className="space-y-4">
                {fieldGroups.map((group) => (
                  <Card key={group.name} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-sm flex items-center gap-2">
                        <span>{group.icon}</span>
                        {group.name}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {group.fields.filter(f => formData[f.id]).length}/{group.fields.length}
                      </Badge>
                    </div>
                    
                    <div className="space-y-3">
                      {group.fields.map((field) => (
                        <div key={field.id} className="space-y-1.5">
                          <Label className="text-xs flex items-center gap-1">
                            {field.field_label}
                            {field.required && <span className="text-red-500">*</span>}
                          </Label>
                          {renderFieldInput(field)}
                          {fieldErrors[field.id] && (
                            <p className="text-xs text-red-500">{fieldErrors[field.id]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </ScrollArea>

          {/* AI Assistant Footer with Chat Input */}
          <div className="border-t bg-gradient-to-r from-purple-50 to-pink-50">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">AI Assistant</span>
                <Badge variant="secondary" className="text-xs">Beta</Badge>
              </div>
              <p className="text-xs text-gray-600 mb-3">
                Ask questions about your document or click fields for help
              </p>
              
              {/* Chat Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Ask a question about this document..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleChatSubmit()
                    }
                  }}
                  disabled={chatLoading}
                  className="flex-1 text-sm"
                />
                <Button
                  size="sm"
                  onClick={handleChatSubmit}
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-3"
                >
                  {chatLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
    </>
  )
}