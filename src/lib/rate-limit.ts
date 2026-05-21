// Simple sliding-window rate limiter — per-serverless-instance.
// Provides basic protection without external infra.
const windows = new Map<string, { count: number; start: number }>()

export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now()
  const entry = windows.get(key)

  if (!entry || now - entry.start > windowMs) {
    windows.set(key, { count: 1, start: now })
    return { allowed: true, remaining: maxRequests - 1, retryAfterMs: 0 }
  }

  if (entry.count >= maxRequests) {
    const retryAfterMs = windowMs - (now - entry.start)
    return { allowed: false, remaining: 0, retryAfterMs }
  }

  entry.count++
  return { allowed: true, remaining: maxRequests - entry.count, retryAfterMs: 0 }
}
