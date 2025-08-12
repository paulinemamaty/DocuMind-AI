import { DocumentUpload } from '@/components/document-upload'
import { DocumentsList } from '@/components/documents-list'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function DocumentsPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Document Manager</h1>
        <p className="text-muted-foreground">
          Upload and manage your documents with AI-powered processing
        </p>
      </div>

      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="documents">My Documents</TabsTrigger>
          <TabsTrigger value="upload">Upload New</TabsTrigger>
        </TabsList>
        
        <TabsContent value="documents" className="mt-6">
          <DocumentsList />
        </TabsContent>
        
        <TabsContent value="upload" className="mt-6">
          <DocumentUpload />
        </TabsContent>
      </Tabs>
    </div>
  )
}