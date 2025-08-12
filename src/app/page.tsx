import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  FileText, 
  MessageSquare, 
  Edit3, 
  Zap, 
  Shield, 
  Cloud,
  ChevronRight,
  Upload,
  Search,
  Bot,
  Download,
  CheckCircle
} from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full mb-6">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-medium">Powered by Google Document AI & GPT-4</span>
          </div>
          
          <h1 className="text-6xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-6">
            Transform Documents into
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Intelligent Workspaces
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-10 leading-relaxed">
            Upload any document and watch as AI extracts text, detects forms, 
            <br />
            and enables intelligent conversations with your content.
          </p>
          
          <div className="flex gap-4 justify-center mb-12">
            <Link href="/documents">
              <Button size="lg" className="h-12 px-8 text-base">
                <Upload className="mr-2 h-5 w-5" />
                Upload Documents
              </Button>
            </Link>
            <Link href="/documents">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                View Documents
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Trust Badges */}
          <div className="flex items-center justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Enterprise Security</span>
            </div>
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              <span>Cloud Storage</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>GDPR Compliant</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Powerful Features</h2>
          <p className="text-gray-600">Everything you need to work with documents intelligently</p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <Card className="border-2 hover:border-blue-500 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle>Smart OCR Processing</CardTitle>
              <CardDescription>
                Extract text, tables, and form fields from PDFs and images with 99% accuracy
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Multi-language support
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Table extraction
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Form field detection
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-purple-500 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <MessageSquare className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle>AI-Powered Chat</CardTitle>
              <CardDescription>
                Ask questions and get instant answers about your documents using GPT-4
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Context-aware responses
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Multi-document search
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Citation tracking
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-green-500 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Edit3 className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>Interactive Editor</CardTitle>
              <CardDescription>
                Fill forms, add signatures, and annotate documents directly in your browser
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Form auto-fill
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Digital signatures
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Export to PDF
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-orange-500 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-orange-600" />
              </div>
              <CardTitle>Semantic Search</CardTitle>
              <CardDescription>
                Find information across all your documents using natural language queries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Vector embeddings
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Cross-document search
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Similarity matching
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-red-500 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <Bot className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle>Intelligent Automation</CardTitle>
              <CardDescription>
                Automate document processing workflows with AI-powered pipelines
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Batch processing
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Auto-categorization
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Smart validation
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-indigo-500 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <Download className="h-6 w-6 text-indigo-600" />
              </div>
              <CardTitle>Export & Integration</CardTitle>
              <CardDescription>
                Export processed data in multiple formats and integrate with your tools
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  JSON/CSV export
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  API access
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Webhook support
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-16 bg-gray-50 rounded-3xl my-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">How It Works</h2>
          <p className="text-gray-600">Get started in minutes with our simple workflow</p>
        </div>
        
        <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto">
          <div className="text-center">
            <div className="h-16 w-16 bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              1
            </div>
            <h3 className="font-semibold mb-2">Upload Document</h3>
            <p className="text-sm text-gray-600">
              Drag and drop your PDF, image, or document file
            </p>
          </div>
          
          <div className="text-center">
            <div className="h-16 w-16 bg-purple-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              2
            </div>
            <h3 className="font-semibold mb-2">AI Processing</h3>
            <p className="text-sm text-gray-600">
              Our AI extracts text, forms, and generates embeddings
            </p>
          </div>
          
          <div className="text-center">
            <div className="h-16 w-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              3
            </div>
            <h3 className="font-semibold mb-2">Interactive Editing</h3>
            <p className="text-sm text-gray-600">
              Fill forms, chat with AI, and annotate your document
            </p>
          </div>
          
          <div className="text-center">
            <div className="h-16 w-16 bg-orange-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              4
            </div>
            <h3 className="font-semibold mb-2">Export & Share</h3>
            <p className="text-sm text-gray-600">
              Download your completed document or share with others
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
          <CardContent className="text-center py-12">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Transform Your Documents?
            </h2>
            <p className="text-blue-100 mb-8 text-lg">
              Start your free trial today and experience the power of AI-driven document processing
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/documents">
                <Button size="lg" variant="secondary" className="h-12 px-8">
                  <Upload className="mr-2 h-5 w-5" />
                  Start Free Trial
                </Button>
              </Link>
              <Link href="/documents">
                <Button size="lg" variant="outline" className="h-12 px-8 bg-white/10 text-white border-white/20 hover:bg-white/20">
                  View Library
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}