# Google Document AI Setup Guide

## Overview
DocuMind AI uses Google Cloud Document AI for advanced document processing including:
- OCR (Optical Character Recognition)
- Form field detection and extraction
- Layout analysis
- Document summarization

## Prerequisites
1. Google Cloud Platform account
2. Billing enabled on GCP project
3. Document AI API enabled

## Setup Steps

### 1. Create GCP Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Note your Project ID and Project Number

### 2. Enable APIs
Enable the following APIs in your project:
- Document AI API
- Cloud Storage API (optional, for batch processing)

### 3. Create Service Account
1. Go to IAM & Admin > Service Accounts
2. Click "Create Service Account"
3. Name: `documind-ai-service`
4. Grant role: `Document AI API User`
5. Create and download JSON key
6. Save as `service-account-key.json` in project root

### 4. Create Document AI Processors
In the Document AI console, create these processors:

#### OCR Processor
- Type: Document OCR
- Purpose: Extract all text from documents
- Location: US or EU

#### Form Parser Processor  
- Type: Form Parser
- Purpose: Detect and extract form fields
- Location: Same as OCR

#### Layout Parser Processor
- Type: Layout Parser
- Purpose: Analyze document structure
- Location: Same as OCR

#### Summarizer Processor
- Type: Summarizer (or Entity Extractor if available)
- Purpose: Extract key information
- Location: Same as OCR

### 5. Configure Environment Variables
Add to `.env.local`:
```env
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_PROJECT_NUMBER=your-project-number
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
GCP_LOCATION=us
GCP_OCR_PROCESSOR_ID=your-ocr-id
GCP_FORM_PARSER_PROCESSOR_ID=your-form-parser-id
GCP_LAYOUT_PARSER_PROCESSOR_ID=your-layout-parser-id
GCP_SUMMARIZER_PROCESSOR_ID=your-summarizer-id
```

## Testing

Visit `/test-document-ai` to verify configuration.

## Processing Pipeline

When a document is uploaded:

1. **OCR Processing**: Extracts all text with formatting
2. **Form Detection**: Identifies form fields and their locations
3. **Layout Analysis**: Understands document structure (headers, paragraphs, tables)
4. **Data Extraction**: Pulls out entities like names, dates, amounts
5. **Storage**: Results saved to Supabase for quick retrieval

## Supported File Types
- PDF documents
- Images: PNG, JPEG, TIFF, GIF, BMP, WEBP

## Rate Limits & Quotas
- Default: 100 requests per minute
- Max file size: 20MB
- Max pages per document: 200

## Cost Optimization
- Cache processed results in database
- Use batch processing for multiple documents
- Only process new/updated documents

## Troubleshooting

### "Permission Denied" Error
- Verify service account has Document AI API User role
- Check that API is enabled in GCP project

### "Processor Not Found" Error
- Verify processor IDs match exactly
- Ensure processors are in the correct region
- Check processor is not deleted/disabled

### Slow Processing
- Document AI can take 5-30 seconds per document
- Consider async processing with status updates
- Use webhooks or polling for results

## Security Notes
- Never commit service account key to git
- Use environment variables for all credentials
- Rotate service account keys regularly
- Limit service account permissions to minimum required