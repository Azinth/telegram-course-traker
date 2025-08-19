/**
 * Rate limiting utility for API endpoints
 * Uses in-memory storage for simplicity, but in production should use Redis or similar
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
// In production, use Redis or similar distributed cache
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Check if a request is within rate limits
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const windowEnd = now + config.windowMs;

  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    // First request or window expired, create new entry
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: windowEnd,
    };
    rateLimitStore.set(identifier, newEntry);

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: windowEnd,
    };
  }

  if (entry.count >= config.maxRequests) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000), // seconds
    };
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(identifier, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Create rate limit identifier from IP and user email
 */
export function createRateLimitIdentifier(ip: string, email?: string): string {
  // Use email if available for authenticated requests, otherwise use IP
  return email ? `user:${email}` : `ip:${ip}`;
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  // Migration endpoints are more restrictive due to their sensitive nature
  MIGRATION_GET: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
  },
  MIGRATION_POST: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 3, // 3 migration executions per minute
  },
} as const;
