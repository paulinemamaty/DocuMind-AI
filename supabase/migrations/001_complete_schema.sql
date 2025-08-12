-- ============================================
-- DocuMind AI Complete Database Schema
-- Single migration file - Run this in Supabase SQL Editor
-- ============================================

-- 1. Add missing columns to existing tables
DO $$ 
BEGIN
  -- Documents table additions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'processing_error') THEN
    ALTER TABLE documents ADD COLUMN processing_error TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'processing_attempts') THEN
    ALTER TABLE documents ADD COLUMN processing_attempts INTEGER DEFAULT 0;
  END IF;
  
  -- Document extractions additions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_extractions' AND column_name = 'summary') THEN
    ALTER TABLE document_extractions ADD COLUMN summary TEXT;
  END IF;
  
  -- Form fields additions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_form_fields' AND column_name = 'confidence') THEN
    ALTER TABLE document_form_fields ADD COLUMN confidence NUMERIC(3,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_form_fields' AND column_name = 'field_value') THEN
    ALTER TABLE document_form_fields ADD COLUMN field_value TEXT;
  END IF;
END $$;

-- 2. Create new tables for edge functions

-- Processing queue for async document processing
CREATE TABLE IF NOT EXISTS processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  processor_types TEXT[] DEFAULT ARRAY['ocr', 'formParser'],
  options JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Webhook configuration
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret TEXT,
  active BOOLEAN DEFAULT true,
  headers JSONB DEFAULT '{}',
  retry_config JSONB DEFAULT '{"max_attempts": 3, "backoff_multiplier": 2, "initial_delay_ms": 1000}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Webhook events log
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Webhook delivery tracking
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,
  endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  status_code INTEGER,
  attempt INTEGER DEFAULT 1,
  error TEXT,
  delivered_at TIMESTAMPTZ DEFAULT now()
);

-- Processing metrics for monitoring
CREATE TABLE IF NOT EXISTS processing_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  processor_type TEXT NOT NULL,
  processing_time_ms INTEGER,
  tokens_used INTEGER,
  error_count INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Rate limiting tracker
CREATE TABLE IF NOT EXISTS rate_limit_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  tokens_limit INTEGER DEFAULT 600,
  window_start TIMESTAMPTZ DEFAULT now(),
  window_end TIMESTAMPTZ DEFAULT now() + INTERVAL '1 minute',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(resource_type, resource_id, window_start)
);

-- 3. Create all indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_user_status ON documents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_document ON chat_sessions(user_id, document_id);
CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_priority ON processing_queue(priority DESC, scheduled_at ASC);
CREATE INDEX IF NOT EXISTS idx_processing_queue_document ON processing_queue(document_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_active ON webhook_endpoints(active);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_events ON webhook_endpoints USING GIN(events);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(type);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON webhook_deliveries(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON webhook_deliveries(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_processing_metrics_document ON processing_metrics(document_id);
CREATE INDEX IF NOT EXISTS idx_processing_metrics_processor ON processing_metrics(processor_type);
CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_resource ON rate_limit_tracking(resource_type, resource_id);

-- 4. Enable Row Level Security
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_tracking ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies

-- Service role has full access
CREATE POLICY "Service role full access to processing_queue" ON processing_queue
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to webhook_endpoints" ON webhook_endpoints
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to webhook_events" ON webhook_events
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to webhook_deliveries" ON webhook_deliveries
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to processing_metrics" ON processing_metrics
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to rate_limit_tracking" ON rate_limit_tracking
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Users can view their own data
CREATE POLICY "Users can view own queue items" ON processing_queue
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM documents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own metrics" ON processing_metrics
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM documents WHERE user_id = auth.uid()
    )
  );

-- 6. Create utility functions

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_processing_queue_updated_at') THEN
    CREATE TRIGGER update_processing_queue_updated_at 
    BEFORE UPDATE ON processing_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_webhook_endpoints_updated_at') THEN
    CREATE TRIGGER update_webhook_endpoints_updated_at 
    BEFORE UPDATE ON webhook_endpoints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Queue statistics function
CREATE OR REPLACE FUNCTION get_queue_statistics()
RETURNS TABLE (
  pending_count BIGINT,
  processing_count BIGINT,
  completed_count BIGINT,
  failed_count BIGINT,
  avg_wait_time_ms NUMERIC,
  avg_processing_time_ms NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
    COUNT(*) FILTER (WHERE status = 'processing') AS processing_count,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
    AVG(EXTRACT(EPOCH FROM (started_at - scheduled_at)) * 1000) FILTER (WHERE started_at IS NOT NULL) AS avg_wait_time_ms,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000) FILTER (WHERE completed_at IS NOT NULL) AS avg_processing_time_ms
  FROM processing_queue;
END;
$$ LANGUAGE plpgsql;

-- Processing metrics summary function
CREATE OR REPLACE FUNCTION get_processing_metrics_summary(
  p_document_id UUID DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT now() - INTERVAL '7 days',
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  processor_type TEXT,
  total_processed BIGINT,
  avg_processing_time_ms NUMERIC,
  total_errors BIGINT,
  total_retries BIGINT,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pm.processor_type,
    COUNT(*) AS total_processed,
    AVG(pm.processing_time_ms) AS avg_processing_time_ms,
    SUM(pm.error_count) AS total_errors,
    SUM(pm.retry_count) AS total_retries,
    COUNT(*) FILTER (WHERE pm.status = 'success') * 100.0 / COUNT(*) AS success_rate
  FROM processing_metrics pm
  WHERE (p_document_id IS NULL OR pm.document_id = p_document_id)
    AND pm.created_at BETWEEN p_start_date AND p_end_date
  GROUP BY pm.processor_type;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old queue items function
CREATE OR REPLACE FUNCTION cleanup_old_queue_items()
RETURNS void AS $$
BEGIN
  DELETE FROM processing_queue
  WHERE status IN ('completed', 'failed')
    AND completed_at < now() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- 7. Clean up orphaned records (optional - remove if you want to keep orphaned data)
DELETE FROM document_chunks WHERE document_id NOT IN (SELECT id FROM documents);
DELETE FROM document_extractions WHERE document_id NOT IN (SELECT id FROM documents);
DELETE FROM document_form_fields WHERE document_id NOT IN (SELECT id FROM documents);
DELETE FROM chat_sessions WHERE document_id NOT IN (SELECT id FROM documents);

-- ============================================
-- Migration Complete
-- ============================================