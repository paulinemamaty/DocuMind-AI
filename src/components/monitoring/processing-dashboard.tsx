'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react'

interface QueueStats {
  pending: number
  processing: number
  completed: number
  failed: number
  averageWaitTime: number
  averageProcessingTime: number
}

interface ProcessingMetric {
  processor_type: string
  total_processed: number
  avg_processing_time_ms: number
  total_errors: number
  total_retries: number
  success_rate: number
}

interface QueueItem {
  id: string
  document_id: string
  status: string
  priority: number
  attempts: number
  processor_types: string[]
  scheduled_at: string
  started_at?: string
  completed_at?: string
  error?: string
}

export function ProcessingDashboard() {
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null)
  const [metrics, setMetrics] = useState<ProcessingMetric[]>([])
  const [recentQueue, setRecentQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const supabase = createClient()

  const fetchQueueStats = async () => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      
      const response = await fetch(`${supabaseUrl}/functions/v1/queue-manager?action=stats`, {
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setQueueStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch queue stats:', error)
    }
  }

  const fetchMetrics = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_processing_metrics_summary')
      
      if (data && !error) {
        setMetrics(data)
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error)
    }
  }

  const fetchRecentQueue = async () => {
    try {
      const { data, error } = await supabase
        .from('processing_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      
      if (data && !error) {
        setRecentQueue(data)
      }
    } catch (error) {
      console.error('Failed to fetch queue items:', error)
    }
  }

  const refreshData = async () => {
    setLoading(true)
    await Promise.all([
      fetchQueueStats(),
      fetchMetrics(),
      fetchRecentQueue()
    ])
    setLoading(false)
  }

  useEffect(() => {
    refreshData()
    
    if (autoRefresh) {
      const interval = setInterval(refreshData, 5000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      completed: 'default',
      processing: 'secondary',
      failed: 'destructive',
      pending: 'outline'
    }
    
    return (
      <Badge variant={variants[status] || 'outline'} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Processing Dashboard</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Disable' : 'Enable'} Auto-refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Queue Statistics */}
      {queueStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{queueStats.pending}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Avg wait: {formatTime(queueStats.averageWaitTime)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {queueStats.processing}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Avg time: {formatTime(queueStats.averageProcessingTime)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {queueStats.completed}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {queueStats.failed}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Processor Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Processor Performance</CardTitle>
          <CardDescription>Processing metrics by Document AI processor type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.map((metric) => (
              <div key={metric.processor_type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">
                      {metric.processor_type.replace('_', ' ')}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {metric.total_processed} processed
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      Avg: {formatTime(metric.avg_processing_time_ms)}
                    </span>
                    <span className="text-muted-foreground">
                      Success: {metric.success_rate.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <Progress value={metric.success_rate} className="h-2" />
                {metric.total_errors > 0 && (
                  <p className="text-xs text-red-600">
                    {metric.total_errors} errors, {metric.total_retries} retries
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Queue Items */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Queue Items</CardTitle>
          <CardDescription>Latest documents in the processing queue</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentQueue.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getStatusBadge(item.status)}
                  <div>
                    <p className="text-sm font-medium">
                      Document {item.document_id.slice(0, 8)}...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Priority: {item.priority} | Attempts: {item.attempts}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {item.processor_types.join(', ')}
                  </p>
                  {item.error && (
                    <p className="text-xs text-red-600 mt-1">{item.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}