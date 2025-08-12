import { DocumentProcessorServiceClient } from '@google-cloud/documentai'
import { documentAIConfig } from './document-ai-config'

interface PooledClient {
  client: DocumentProcessorServiceClient
  lastUsed: number
  requestCount: number
  processorType?: string
}

interface PoolConfig {
  maxClients: number
  maxRequestsPerClient: number
  clientTTL: number // Time to live in milliseconds
  cleanupInterval: number // Cleanup interval in milliseconds
}

class DocumentAIConnectionPool {
  private clients: Map<string, PooledClient>
  private config: PoolConfig
  private cleanupTimer: NodeJS.Timeout | null = null
  private requestQueue: Array<() => void> = []
  private activeRequests = 0
  private maxConcurrentRequests = 50

  constructor(config?: Partial<PoolConfig>) {
    this.config = {
      maxClients: 10,
      maxRequestsPerClient: 1000,
      clientTTL: 5 * 60 * 1000, // 5 minutes
      cleanupInterval: 60 * 1000, // 1 minute
      ...config
    }
    
    this.clients = new Map()
    this.startCleanupTimer()
  }

  private startCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupInterval)
  }

  private cleanup() {
    const now = Date.now()
    const expiredKeys: string[] = []
    
    this.clients.forEach((pooledClient, key) => {
      const age = now - pooledClient.lastUsed
      
      // Remove clients that are too old or have processed too many requests
      if (
        age > this.config.clientTTL ||
        pooledClient.requestCount >= this.config.maxRequestsPerClient
      ) {
        expiredKeys.push(key)
      }
    })
    
    expiredKeys.forEach(key => {
      this.clients.delete(key)
      console.log(`Removed expired client from pool: ${key}`)
    })
  }

  private generateClientKey(processorType?: string): string {
    // Create a unique key for the client based on processor type
    // This allows us to reuse clients for the same processor
    const baseKey = processorType || 'default'
    const existingCount = Array.from(this.clients.keys()).filter(key => 
      key.startsWith(baseKey)
    ).length
    
    if (existingCount < Math.ceil(this.config.maxClients / 4)) {
      return `${baseKey}_${existingCount}`
    }
    
    // Find the least used client for this processor type
    let leastUsedKey = `${baseKey}_0`
    let minRequests = Infinity
    
    this.clients.forEach((client, key) => {
      if (key.startsWith(baseKey) && client.requestCount < minRequests) {
        minRequests = client.requestCount
        leastUsedKey = key
      }
    })
    
    return leastUsedKey
  }

  async getClient(processorType?: string): Promise<DocumentProcessorServiceClient> {
    // Wait if we're at max concurrent requests
    if (this.activeRequests >= this.maxConcurrentRequests) {
      await new Promise<void>(resolve => {
        this.requestQueue.push(resolve)
      })
    }
    
    this.activeRequests++
    
    const key = this.generateClientKey(processorType)
    let pooledClient = this.clients.get(key)
    
    if (!pooledClient) {
      // Create new client if not in pool
      const client = new DocumentProcessorServiceClient({
        keyFilename: documentAIConfig.keyFilename,
      })
      
      pooledClient = {
        client,
        lastUsed: Date.now(),
        requestCount: 0,
        processorType
      }
      
      this.clients.set(key, pooledClient)
      console.log(`Created new client in pool: ${key}`)
    }
    
    // Update usage statistics
    pooledClient.lastUsed = Date.now()
    pooledClient.requestCount++
    
    return pooledClient.client
  }

  releaseClient() {
    this.activeRequests--
    
    // Process queued requests
    if (this.requestQueue.length > 0) {
      const resolve = this.requestQueue.shift()
      if (resolve) {
        resolve()
      }
    }
  }

  getPoolStats() {
    const stats = {
      totalClients: this.clients.size,
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length,
      clientStats: [] as Array<{
        key: string
        requestCount: number
        age: number
        processorType?: string
      }>
    }
    
    const now = Date.now()
    this.clients.forEach((client, key) => {
      stats.clientStats.push({
        key,
        requestCount: client.requestCount,
        age: now - client.lastUsed,
        processorType: client.processorType
      })
    })
    
    return stats
  }

  async shutdown() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    
    // Wait for all active requests to complete
    while (this.activeRequests > 0) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    // Clear all clients
    this.clients.clear()
    this.requestQueue = []
  }
}

// Singleton instance
let poolInstance: DocumentAIConnectionPool | null = null

export function getConnectionPool(config?: Partial<PoolConfig>): DocumentAIConnectionPool {
  if (!poolInstance) {
    poolInstance = new DocumentAIConnectionPool(config)
  }
  return poolInstance
}

export async function executeWithPooledClient<T>(
  processorType: string,
  operation: (client: DocumentProcessorServiceClient) => Promise<T>
): Promise<T> {
  const pool = getConnectionPool()
  const client = await pool.getClient(processorType)
  
  try {
    const result = await operation(client)
    return result
  } finally {
    pool.releaseClient()
  }
}

// Helper function for batch operations with connection pooling
export async function executeBatchWithPool<T>(
  items: T[],
  processorType: string,
  operation: (client: DocumentProcessorServiceClient, item: T) => Promise<any>,
  maxConcurrency: number = 5
): Promise<any[]> {
  const pool = getConnectionPool()
  const results: any[] = []
  const queue = [...items]
  const processing = new Map<number, Promise<any>>()
  
  while (queue.length > 0 || processing.size > 0) {
    // Start new operations up to max concurrency
    while (processing.size < maxConcurrency && queue.length > 0) {
      const item = queue.shift()!
      const index = items.indexOf(item)
      
      const promise = (async () => {
        const client = await pool.getClient(processorType)
        try {
          return await operation(client, item)
        } finally {
          pool.releaseClient()
        }
      })()
      
      processing.set(index, promise)
    }
    
    // Wait for at least one to complete
    if (processing.size > 0) {
      const completedIndex = await Promise.race(
        Array.from(processing.entries()).map(async ([idx, promise]) => {
          await promise
          return idx
        })
      )
      
      const result = await processing.get(completedIndex)
      results[completedIndex] = result
      processing.delete(completedIndex)
    }
  }
  
  return results
}

// Export pool statistics for monitoring
export function getPoolStatistics() {
  const pool = getConnectionPool()
  return pool.getPoolStats()
}

// Graceful shutdown
export async function shutdownConnectionPool() {
  if (poolInstance) {
    await poolInstance.shutdown()
    poolInstance = null
  }
}