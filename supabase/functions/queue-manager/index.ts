import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface QueueItem {
  id: string
  document_id: string
  priority: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  attempts: number
  max_attempts: number
  scheduled_at: string
  started_at?: string
  completed_at?: string
  error?: string
  processor_types: string[]
  options?: any
}

interface QueueStats {
  pending: number
  processing: number
  completed: number
  failed: number
  averageWaitTime: number
  averageProcessingTime: number
}

class ProcessingQueue {
  private supabase: any
  private maxConcurrent: number
  private processingItems: Set<string>

  constructor(supabase: any, maxConcurrent: number = 10) {
    this.supabase = supabase
    this.maxConcurrent = maxConcurrent
    this.processingItems = new Set()
  }

  async addToQueue(
    documentId: string,
    priority: number = 5,
    processorTypes: string[] = ['ocr', 'formParser'],
    options: any = {}
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('processing_queue')
      .insert({
        document_id: documentId,
        priority,
        status: 'pending',
        attempts: 0,
        max_attempts: 3,
        scheduled_at: new Date().toISOString(),
        processor_types: processorTypes,
        options
      })
      .select()
      .single()

    if (error) throw error
    return data.id
  }

  async processQueue(): Promise<void> {
    // Get pending items sorted by priority and scheduled time
    const { data: pendingItems, error } = await this.supabase
      .from('processing_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', 'max_attempts')
      .order('priority', { ascending: false })
      .order('scheduled_at', { ascending: true })
      .limit(this.maxConcurrent - this.processingItems.size)

    if (error || !pendingItems || pendingItems.length === 0) {
      return
    }

    // Process items concurrently
    const promises = pendingItems.map(item => this.processItem(item))
    await Promise.allSettled(promises)
  }

  private async processItem(item: QueueItem): Promise<void> {
    if (this.processingItems.has(item.id)) {
      return
    }

    this.processingItems.add(item.id)

    try {
      // Update status to processing
      await this.supabase
        .from('processing_queue')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
          attempts: item.attempts + 1
        })
        .eq('id', item.id)

      // Call process-document function
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      
      const response = await fetch(`${supabaseUrl}/functions/v1/process-document`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentId: item.document_id,
          priority: item.priority,
          processorTypes: item.processor_types,
          options: item.options
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(error)
      }

      // Update status to completed
      await this.supabase
        .from('processing_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', item.id)

    } catch (error: any) {
      console.error(`Failed to process queue item ${item.id}:`, error.message)

      // Check if should retry
      if (item.attempts + 1 >= item.max_attempts) {
        // Mark as failed
        await this.supabase
          .from('processing_queue')
          .update({
            status: 'failed',
            error: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', item.id)
      } else {
        // Schedule for retry with exponential backoff
        const backoffMinutes = Math.pow(2, item.attempts) * 5
        const scheduledAt = new Date(Date.now() + backoffMinutes * 60000).toISOString()

        await this.supabase
          .from('processing_queue')
          .update({
            status: 'pending',
            scheduled_at: scheduledAt,
            error: error.message
          })
          .eq('id', item.id)
      }
    } finally {
      this.processingItems.delete(item.id)
    }
  }

  async getQueueStats(): Promise<QueueStats> {
    const { data: stats } = await this.supabase
      .from('processing_queue')
      .select('status, started_at, completed_at, scheduled_at')

    if (!stats) {
      return {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        averageWaitTime: 0,
        averageProcessingTime: 0
      }
    }

    const statusCounts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    }

    let totalWaitTime = 0
    let totalProcessingTime = 0
    let waitTimeCount = 0
    let processingTimeCount = 0

    stats.forEach((item: any) => {
      statusCounts[item.status as keyof typeof statusCounts]++

      if (item.started_at && item.scheduled_at) {
        const waitTime = new Date(item.started_at).getTime() - new Date(item.scheduled_at).getTime()
        totalWaitTime += waitTime
        waitTimeCount++
      }

      if (item.completed_at && item.started_at) {
        const processingTime = new Date(item.completed_at).getTime() - new Date(item.started_at).getTime()
        totalProcessingTime += processingTime
        processingTimeCount++
      }
    })

    return {
      ...statusCounts,
      averageWaitTime: waitTimeCount > 0 ? totalWaitTime / waitTimeCount : 0,
      averageProcessingTime: processingTimeCount > 0 ? totalProcessingTime / processingTimeCount : 0
    }
  }

  async cleanupOldItems(daysOld: number = 7): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await this.supabase
      .from('processing_queue')
      .delete()
      .in('status', ['completed', 'failed'])
      .lt('completed_at', cutoffDate)
      .select()

    return data?.length || 0
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'process'

    const queue = new ProcessingQueue(supabase)

    switch (action) {
      case 'add': {
        const { documentId, priority, processorTypes, options } = await req.json()
        const queueId = await queue.addToQueue(documentId, priority, processorTypes, options)
        
        return new Response(
          JSON.stringify({ success: true, queueId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'process': {
        // Process queue items
        await queue.processQueue()
        
        return new Response(
          JSON.stringify({ success: true, message: 'Queue processed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'stats': {
        const stats = await queue.getQueueStats()
        
        return new Response(
          JSON.stringify({ success: true, stats }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'cleanup': {
        const daysOld = parseInt(url.searchParams.get('days') || '7')
        const deletedCount = await queue.cleanupOldItems(daysOld)
        
        return new Response(
          JSON.stringify({ success: true, deletedCount }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        throw new Error('Invalid action')
    }

  } catch (error: any) {
    console.error('Queue manager error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})