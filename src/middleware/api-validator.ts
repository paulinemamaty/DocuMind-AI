import { NextRequest, NextResponse } from 'next/server'

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS'
}

export interface EndpointConfig {
  path: string
  methods: HttpMethod[]
  requiresAuth?: boolean
  rateLimit?: {
    requests: number
    windowMs: number
  }
  validation?: {
    body?: Record<string, any>
    query?: Record<string, any>
    params?: Record<string, any>
  }
}

/**
 * API Endpoint Validator Middleware
 * Prevents HTTP method confusion and validates requests
 */
export class APIValidator {
  private static endpoints: Map<string, EndpointConfig> = new Map()
  private static rateLimits: Map<string, { count: number; resetAt: number }> = new Map()

  /**
   * Register an endpoint configuration
   */
  static registerEndpoint(config: EndpointConfig) {
    this.endpoints.set(config.path, config)
  }

  /**
   * Register multiple endpoints at once
   */
  static registerEndpoints(configs: EndpointConfig[]) {
    configs.forEach(config => this.registerEndpoint(config))
  }

  /**
   * Validate an incoming request
   */
  static async validateRequest(
    request: NextRequest,
    path: string
  ): Promise<{ valid: boolean; error?: NextResponse }> {
    // Get endpoint configuration
    const config = this.findEndpointConfig(path)
    
    if (!config) {
      // No configuration found, allow request (backwards compatibility)
      return { valid: true }
    }

    // Check HTTP method
    const methodCheck = this.validateMethod(request.method, config)
    if (!methodCheck.valid) {
      return {
        valid: false,
        error: NextResponse.json(
          { 
            error: methodCheck.error,
            allowedMethods: config.methods 
          },
          { status: 405, headers: { 'Allow': config.methods.join(', ') } }
        )
      }
    }

    // Check authentication if required
    if (config.requiresAuth) {
      const authCheck = await this.validateAuth(request)
      if (!authCheck.valid) {
        return {
          valid: false,
          error: NextResponse.json(
            { error: authCheck.error },
            { status: 401 }
          )
        }
      }
    }

    // Check rate limiting
    if (config.rateLimit) {
      const rateLimitCheck = this.checkRateLimit(request, config)
      if (!rateLimitCheck.valid) {
        return {
          valid: false,
          error: NextResponse.json(
            { 
              error: rateLimitCheck.error,
              retryAfter: rateLimitCheck.retryAfter 
            },
            { 
              status: 429,
              headers: { 'Retry-After': String(rateLimitCheck.retryAfter) }
            }
          )
        }
      }
    }

    // Validate request body/query/params if specified
    if (config.validation) {
      const validationCheck = await this.validateRequestData(request, config.validation)
      if (!validationCheck.valid) {
        return {
          valid: false,
          error: NextResponse.json(
            { 
              error: 'Validation failed',
              details: validationCheck.errors 
            },
            { status: 400 }
          )
        }
      }
    }

    return { valid: true }
  }

  /**
   * Find endpoint configuration by path
   */
  private static findEndpointConfig(path: string): EndpointConfig | undefined {
    // Direct match
    if (this.endpoints.has(path)) {
      return this.endpoints.get(path)
    }

    // Pattern matching for dynamic routes
    for (const [pattern, config] of this.endpoints) {
      if (this.matchPath(path, pattern)) {
        return config
      }
    }

    return undefined
  }

  /**
   * Match path with pattern (supports [param] syntax)
   */
  private static matchPath(path: string, pattern: string): boolean {
    // Convert Next.js dynamic route pattern to regex
    const regexPattern = pattern
      .replace(/\[([^\]]+)\]/g, '([^/]+)') // Replace [param] with regex
      .replace(/\//g, '\\/') // Escape forward slashes
    
    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(path)
  }

  /**
   * Validate HTTP method
   */
  private static validateMethod(
    method: string,
    config: EndpointConfig
  ): { valid: boolean; error?: string } {
    const httpMethod = method.toUpperCase() as HttpMethod
    
    if (!config.methods.includes(httpMethod)) {
      return {
        valid: false,
        error: `Method ${method} not allowed. Allowed methods: ${config.methods.join(', ')}`
      }
    }

    return { valid: true }
  }

  /**
   * Validate authentication
   */
  private static async validateAuth(request: NextRequest): Promise<{ valid: boolean; error?: string }> {
    // Check for auth header or cookie
    const authHeader = request.headers.get('authorization')
    const sessionCookie = request.cookies.get('supabase-auth-token')

    if (!authHeader && !sessionCookie) {
      return {
        valid: false,
        error: 'Authentication required'
      }
    }

    // Additional auth validation would go here
    // For now, just check presence

    return { valid: true }
  }

  /**
   * Check rate limiting
   */
  private static checkRateLimit(
    request: NextRequest,
    config: EndpointConfig
  ): { valid: boolean; error?: string; retryAfter?: number } {
    if (!config.rateLimit) {
      return { valid: true }
    }

    // Get client identifier (IP or user ID)
    const clientId = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    const limitKey = `${config.path}:${clientId}`

    const now = Date.now()
    const limit = this.rateLimits.get(limitKey)

    if (!limit || limit.resetAt < now) {
      // Create new limit window
      this.rateLimits.set(limitKey, {
        count: 1,
        resetAt: now + config.rateLimit.windowMs
      })
      return { valid: true }
    }

    if (limit.count >= config.rateLimit.requests) {
      const retryAfter = Math.ceil((limit.resetAt - now) / 1000)
      return {
        valid: false,
        error: 'Rate limit exceeded',
        retryAfter
      }
    }

    // Increment counter
    limit.count++
    this.rateLimits.set(limitKey, limit)

    return { valid: true }
  }

  /**
   * Validate request data (body, query, params)
   */
  private static async validateRequestData(
    request: NextRequest,
    validation: EndpointConfig['validation']
  ): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = []

    // Validate body
    if (validation?.body && request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        const body = await request.json()
        const bodyErrors = this.validateObject(body, validation.body, 'body')
        errors.push(...bodyErrors)
      } catch (e) {
        errors.push('Invalid JSON body')
      }
    }

    // Validate query parameters
    if (validation?.query) {
      const query = Object.fromEntries(request.nextUrl.searchParams)
      const queryErrors = this.validateObject(query, validation.query, 'query')
      errors.push(...queryErrors)
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    }
  }

  /**
   * Validate object against schema
   */
  private static validateObject(
    obj: any,
    schema: Record<string, any>,
    prefix: string
  ): string[] {
    const errors: string[] = []

    for (const [key, rules] of Object.entries(schema)) {
      const value = obj[key]

      // Check required
      if (rules.required && (value === undefined || value === null)) {
        errors.push(`${prefix}.${key} is required`)
        continue
      }

      // Check type
      if (value !== undefined && rules.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value
        if (actualType !== rules.type) {
          errors.push(`${prefix}.${key} must be of type ${rules.type}`)
        }
      }

      // Check pattern
      if (value && rules.pattern) {
        const regex = new RegExp(rules.pattern)
        if (!regex.test(value)) {
          errors.push(`${prefix}.${key} does not match required pattern`)
        }
      }

      // Check enum
      if (value && rules.enum && !rules.enum.includes(value)) {
        errors.push(`${prefix}.${key} must be one of: ${rules.enum.join(', ')}`)
      }

      // Check min/max for numbers
      if (typeof value === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          errors.push(`${prefix}.${key} must be at least ${rules.min}`)
        }
        if (rules.max !== undefined && value > rules.max) {
          errors.push(`${prefix}.${key} must be at most ${rules.max}`)
        }
      }

      // Check length for strings/arrays
      if ((typeof value === 'string' || Array.isArray(value)) && value.length !== undefined) {
        if (rules.minLength !== undefined && value.length < rules.minLength) {
          errors.push(`${prefix}.${key} must have at least ${rules.minLength} items`)
        }
        if (rules.maxLength !== undefined && value.length > rules.maxLength) {
          errors.push(`${prefix}.${key} must have at most ${rules.maxLength} items`)
        }
      }
    }

    return errors
  }

  /**
   * Clear expired rate limits (cleanup)
   */
  static cleanupRateLimits() {
    const now = Date.now()
    for (const [key, limit] of this.rateLimits) {
      if (limit.resetAt < now) {
        this.rateLimits.delete(key)
      }
    }
  }
}

// Register all API endpoints
APIValidator.registerEndpoints([
  {
    path: '/api/documents/upload',
    methods: [HttpMethod.POST],
    requiresAuth: true,
    rateLimit: { requests: 10, windowMs: 60000 }, // 10 uploads per minute
    validation: {
      body: {
        file: { required: true }
      }
    }
  },
  {
    path: '/api/documents/[id]/pdf',
    methods: [HttpMethod.GET, HttpMethod.HEAD],
    requiresAuth: true,
    rateLimit: { requests: 100, windowMs: 60000 } // 100 requests per minute
  },
  {
    path: '/api/documents/detect-fields',
    methods: [HttpMethod.POST],
    requiresAuth: true,
    rateLimit: { requests: 20, windowMs: 60000 }, // 20 detections per minute
    validation: {
      body: {
        documentId: { required: true, type: 'string' }
      }
    }
  },
  {
    path: '/api/documents/process',
    methods: [HttpMethod.POST],
    requiresAuth: true,
    rateLimit: { requests: 10, windowMs: 60000 },
    validation: {
      body: {
        documentId: { required: true, type: 'string' },
        processorTypes: { type: 'array' },
        useQueue: { type: 'boolean' }
      }
    }
  },
  {
    path: '/api/documents/[id]/status',
    methods: [HttpMethod.GET],
    requiresAuth: true
  },
  {
    path: '/api/chat',
    methods: [HttpMethod.POST],
    requiresAuth: true,
    rateLimit: { requests: 30, windowMs: 60000 }, // 30 messages per minute
    validation: {
      body: {
        message: { required: true, type: 'string', maxLength: 1000 },
        documentId: { required: true, type: 'string' },
        sessionId: { type: 'string' }
      }
    }
  }
])

// Cleanup expired rate limits every 5 minutes
if (typeof window === 'undefined') {
  setInterval(() => {
    APIValidator.cleanupRateLimits()
  }, 5 * 60 * 1000)
}

export default APIValidator