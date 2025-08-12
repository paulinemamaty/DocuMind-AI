# Supabase Edge Functions for DocuMind AI

This directory contains Supabase Edge Functions that handle document processing, embeddings generation, and webhook management for the DocuMind AI platform.

## Functions Overview

### 1. process-document
Main document processing function with Document AI integration.
- **Features**: Rate limiting, retry logic, error mapping, field masks, OCR hints
- **Endpoint**: `/functions/v1/process-document`
- **Method**: POST
- **Payload**:
```json
{
  "documentId": "uuid",
  "priority": 5,
  "processorTypes": ["ocr", "formParser"],
  "options": {
    "fieldMask": "text,entities,pages,tables,formFields",
    "ocrHints": ["en-US"],
    "pageRange": { "start": 1, "end": 10 }
  }
}
```

### 2. batch-process
Batch processing for multiple documents.
- **Features**: Concurrent processing, configurable concurrency, batch statistics
- **Endpoint**: `/functions/v1/batch-process`
- **Method**: POST
- **Max Documents**: 50 per batch
- **Payload**:
```json
{
  "documentIds": ["uuid1", "uuid2"],
  "priority": 5,
  "processorTypes": ["ocr", "formParser"],
  "options": {
    "maxConcurrency": 5,
    "fieldMask": "text,entities,pages,tables,formFields"
  }
}
```

### 3. queue-manager
Manages processing queue with priority levels.
- **Features**: Priority-based processing, automatic retry, exponential backoff
- **Endpoint**: `/functions/v1/queue-manager`
- **Actions**: add, process, stats, cleanup
- **Usage**:
```bash
# Add to queue
?action=add

# Process queue
?action=process

# Get statistics
?action=stats

# Cleanup old items
?action=cleanup&days=7
```

### 4. webhook-handler
Handles webhook events and deliveries.
- **Features**: HMAC signatures, retry logic, event broadcasting
- **Endpoint**: `/functions/v1/webhook-handler`
- **Actions**: send, register, unregister, list, test
- **Event Types**:
  - document.uploaded
  - document.processing
  - document.processed
  - document.failed
  - batch.completed
  - queue.status_changed

### 5. generate-embeddings
Generates vector embeddings for RAG.
- **Features**: Text chunking with overlap, batch processing, similarity search
- **Endpoint**: `/functions/v1/generate-embeddings`
- **Actions**: generate, search, regenerate
- **Model**: OpenAI text-embedding-3-small

## Environment Variables

Each function requires the following environment variables:

```env
# Required
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_CLOUD_PROJECT_NUMBER=your_project_number
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account"...}'
OPENAI_API_KEY=your_openai_key

# Processor IDs
GCP_OCR_PROCESSOR_ID=your_ocr_id
GCP_FORM_PARSER_PROCESSOR_ID=your_form_parser_id
GCP_LAYOUT_PARSER_PROCESSOR_ID=your_layout_parser_id
GCP_SUMMARIZER_PROCESSOR_ID=your_summarizer_id
```

## Deployment

### Prerequisites
1. Install Supabase CLI: `brew install supabase/tap/supabase`
2. Link your project: `supabase link --project-ref your-project-ref`

### Deploy All Functions
```bash
./scripts/deploy-edge-functions.sh
```

### Deploy Individual Function
```bash
supabase functions deploy process-document --no-verify-jwt
```

### Set Environment Variables
```bash
supabase secrets set GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account"...}'
supabase secrets set OPENAI_API_KEY=sk-...
```

## Rate Limiting

The system implements token bucket rate limiting:
- **Default**: 600 requests per minute
- **Burst capacity**: 600 tokens
- **Refill rate**: 600 tokens per minute
- **Automatic retry**: With exponential backoff

## Error Handling

Document AI errors are mapped to user-friendly messages:
- `DEADLINE_EXCEEDED`: Document processing timeout, auto-retry
- `RESOURCE_EXHAUSTED`: Quota exceeded, queued for retry
- `INVALID_ARGUMENT`: Invalid document format
- `UNAVAILABLE`: Service temporarily unavailable

## Monitoring

Use the Processing Dashboard component to monitor:
- Queue statistics (pending, processing, completed, failed)
- Average wait and processing times
- Processor performance metrics
- Success rates and error counts
- Recent queue items

## Database Tables

Required tables (created by migration):
- `processing_queue`: Queue management
- `webhook_endpoints`: Webhook configuration
- `webhook_events`: Event storage
- `webhook_deliveries`: Delivery tracking
- `processing_metrics`: Performance metrics
- `rate_limit_tracking`: Rate limit monitoring

## Testing

### Test Document Processing
```bash
curl -X POST https://your-project.supabase.co/functions/v1/process-document \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"documentId": "uuid", "processorTypes": ["ocr"]}'
```

### Test Batch Processing
```bash
curl -X POST https://your-project.supabase.co/functions/v1/batch-process \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"documentIds": ["uuid1", "uuid2"]}'
```

### Get Queue Statistics
```bash
curl https://your-project.supabase.co/functions/v1/queue-manager?action=stats \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Performance Optimizations

1. **Connection Pooling**: Reuses Document AI client connections
2. **Field Masks**: Reduces payload size by requesting only needed fields
3. **Batch Processing**: Processes multiple documents concurrently
4. **Chunking**: Optimizes embedding generation with configurable chunk sizes
5. **Queue Management**: Priority-based processing with automatic retry

## Security

- All functions require authentication
- Service role key for inter-function communication
- HMAC signatures for webhook verification
- RLS policies on all database tables
- No direct exposure of sensitive credentials

## Troubleshooting

### Function Deployment Fails
- Check Supabase CLI version: `supabase --version`
- Verify project linking: `supabase status`
- Check function logs: `supabase functions logs process-document`

### Processing Errors
- Check rate limits: Monitor `rate_limit_tracking` table
- Verify credentials: Test Document AI access separately
- Review error logs: Check `processing_metrics` table

### Performance Issues
- Monitor connection pool: Check active connections
- Review queue statistics: Use dashboard or stats endpoint
- Check processing times: Analyze `processing_metrics` data