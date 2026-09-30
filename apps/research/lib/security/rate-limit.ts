/**
 * Minimal fixed-window rate limiter for API routes. In-memory, so it is
 * per-instance; production should back this with Redis / Upstash or the
 * edge platform's limiter (see docs/ARCHITECTURE.md → Security).
 */
const buckets = new Map<string, { count: number; reset: number }>()

export function rateLimit(key: string, limit = 60, windowMs = 60_000): { ok: boolean; remaining: number; reset: number } {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs })
    return { ok: true, remaining: limit - 1, reset: now + windowMs }
  }
  b.count++
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k)
  }
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count), reset: b.reset }
}

export function clientKey(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'anon'
}
