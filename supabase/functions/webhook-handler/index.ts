import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WebhookEvent {
  id: string
  type: string
  data: any
  timestamp: string
  signature?: string
}

interface WebhookEndpoint {
  id: string
  url: string
  events: string[]
  secret?: string
  active: boolean
  headers?: Record<string, string>
  retry_config?: {
    max_attempts: number
    backoff_multiplier: number
    initial_delay_ms: number
  }
}

class WebhookManager {
  private supabase: any

  constructor(supabase: any) {
    this.supabase = supabase
  }

  async sendWebhook(event: WebhookEvent, endpoint: WebhookEndpoint): Promise<boolean> {
    const maxAttempts = endpoint.retry_config?.max_attempts || 3
    const backoffMultiplier = endpoint.retry_config?.backoff_multiplier || 2
    const initialDelay = endpoint.retry_config?.initial_delay_ms || 1000

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Generate signature if secret is configured
        let signature = ''
        if (endpoint.secret) {
          const hmac = createHmac('sha256', endpoint.secret)
          hmac.update(JSON.stringify(event))
          signature = hmac.digest('hex')
        }

        // Prepare headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event.type,
          'X-Webhook-Timestamp': event.timestamp,
          ...endpoint.headers
        }

        if (signature) {
          headers['X-Webhook-Signature'] = signature
        }

        // Send webhook
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(event),
          signal: AbortSignal.timeout(30000) // 30 second timeout
        })

        // Log webhook delivery
        await this.logDelivery(event.id, endpoint.id, response.status, attempt + 1)

        if (response.ok) {
          return true
        }

        // Check if should retry
        if (response.status >= 500 || response.status === 429) {
          if (attempt < maxAttempts - 1) {
            const delay = initialDelay * Math.pow(backoffMultiplier, attempt)
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
        }

        return false

      } catch (error: any) {
        console.error(`Webhook delivery failed (attempt ${attempt + 1}):`, error.message)
        
        await this.logDelivery(event.id, endpoint.id, 0, attempt + 1, error.message)

        if (attempt < maxAttempts - 1) {
          const delay = initialDelay * Math.pow(backoffMultiplier, attempt)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    return false
  }

  async logDelivery(
    eventId: string,
    endpointId: string,
    statusCode: number,
    attempt: number,
    error?: string
  ): Promise<void> {
    await this.supabase
      .from('webhook_deliveries')
      .insert({
        event_id: eventId,
        endpoint_id: endpointId,
        status_code: statusCode,
        attempt,
        error,
        delivered_at: new Date().toISOString()
      })
  }

  async getActiveEndpoints(eventType: string): Promise<WebhookEndpoint[]> {
    const { data, error } = await this.supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('active', true)
      .contains('events', [eventType])

    if (error) {
      console.error('Failed to get webhook endpoints:', error)
      return []
    }

    return data || []
  }

  async broadcastEvent(event: WebhookEvent): Promise<void> {
    const endpoints = await this.getActiveEndpoints(event.type)

    if (endpoints.length === 0) {
      console.log(`No active endpoints for event type: ${event.type}`)
      return
    }

    // Send webhooks concurrently
    const promises = endpoints.map(endpoint => 
      this.sendWebhook(event, endpoint)
        .then(success => ({
          endpointId: endpoint.id,
          success
        }))
    )

    const results = await Promise.allSettled(promises)

    // Log results
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    const failed = results.length - successful

    console.log(`Webhook broadcast complete: ${successful} successful, ${failed} failed`)
  }
}

// Event types
const EVENT_TYPES = {
  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_PROCESSING: 'document.processing',
  DOCUMENT_PROCESSED: 'document.processed',
  DOCUMENT_FAILED: 'document.failed',
  DOCUMENT_DELETED: 'document.deleted',
  EXTRACTION_COMPLETED: 'extraction.completed',
  EMBEDDINGS_GENERATED: 'embeddings.generated',
  FORM_FIELDS_DETECTED: 'form_fields.detected',
  BATCH_COMPLETED: 'batch.completed',
  QUEUE_STATUS_CHANGED: 'queue.status_changed'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const manager = new WebhookManager(supabase)

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'send'

    switch (action) {
      case 'send': {
        const { type, data } = await req.json()

        if (!type || !data) {
          throw new Error('Event type and data are required')
        }

        const event: WebhookEvent = {
          id: crypto.randomUUID(),
          type,
          data,
          timestamp: new Date().toISOString()
        }

        // Store event
        await supabase
          .from('webhook_events')
          .insert({
            id: event.id,
            type: event.type,
            data: event.data,
            created_at: event.timestamp
          })

        // Broadcast to endpoints
        await manager.broadcastEvent(event)

        return new Response(
          JSON.stringify({ success: true, eventId: event.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'register': {
        const { url, events, secret, headers } = await req.json()

        if (!url || !events || events.length === 0) {
          throw new Error('URL and events are required')
        }

        const { data, error } = await supabase
          .from('webhook_endpoints')
          .insert({
            url,
            events,
            secret,
            headers,
            active: true,
            retry_config: {
              max_attempts: 3,
              backoff_multiplier: 2,
              initial_delay_ms: 1000
            }
          })
          .select()
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, endpoint: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'unregister': {
        const { endpointId } = await req.json()

        if (!endpointId) {
          throw new Error('Endpoint ID is required')
        }

        await supabase
          .from('webhook_endpoints')
          .update({ active: false })
          .eq('id', endpointId)

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'list': {
        const { data, error } = await supabase
          .from('webhook_endpoints')
          .select('*')
          .eq('active', true)

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, endpoints: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'test': {
        const { endpointId } = await req.json()

        const { data: endpoint, error } = await supabase
          .from('webhook_endpoints')
          .select('*')
          .eq('id', endpointId)
          .single()

        if (error || !endpoint) {
          throw new Error('Endpoint not found')
        }

        const testEvent: WebhookEvent = {
          id: crypto.randomUUID(),
          type: 'test.webhook',
          data: {
            message: 'This is a test webhook',
            timestamp: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        }

        const success = await manager.sendWebhook(testEvent, endpoint)

        return new Response(
          JSON.stringify({ success, testSent: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        throw new Error('Invalid action')
    }

  } catch (error: any) {
    console.error('Webhook handler error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})