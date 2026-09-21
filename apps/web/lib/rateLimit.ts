// @ts-nocheck
// Phase N — per-instance, in-memory sliding-window rate limiter for
// high-risk unauthenticated/low-friction endpoints (guest order creation,
// promo/voucher validation, reviews, push subscribe, search).
//
// HONEST LIMITATION: this is in-memory, so it is scoped to a single
// serverless function instance, not the whole deployment — on Vercel with
// multiple concurrent instances, an attacker distributed across instances
// sees a higher effective limit than the number below. It still stops
// naive single-connection abuse (scripted brute force, a broken retry
// loop) which is the realistic threat for these endpoints, but it is NOT
// a substitute for a real distributed limiter. The production-grade fix
// is a shared store (e.g. Upstash Redis with @upstash/ratelimit) — this
// file is written so swapping the storage backend later only touches
// `hit()`, not every call site.
//
// The one endpoint in this codebase that already needed a real limit
// (app/api/ai/chat/route.ts) correctly uses a DB-backed count instead —
// that pattern is right for anything already touching the DB per request
// and should stay that way, not be migrated to this helper.

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

// Bound memory even under sustained abuse — an unbounded Map keyed by
// spoofable IPs is itself a resource-exhaustion vector.
const MAX_BUCKETS = 20000
let lastSweep = 0

function sweep(now: number) {
  if (now - lastSweep < 60000) return
  lastSweep = now
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key)
  }
  if (buckets.size > MAX_BUCKETS) {
    const excess = buckets.size - MAX_BUCKETS
    let i = 0
    for (const key of buckets.keys()) {
      if (i++ >= excess) break
      buckets.delete(key)
    }
  }
}

/**
 * Returns { allowed, remaining, resetAt } for `key` under a fixed window of
 * `windowMs` allowing `limit` hits. Callers build `key` from route name +
 * client identifier (IP, or IP+something else for extra precision).
 */
export function hit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  sweep(now)
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }
  existing.count += 1
  const allowed = existing.count <= limit
  return { allowed, remaining: Math.max(0, limit - existing.count), resetAt: existing.resetAt }
}

// Best-effort client identifier — Vercel sets x-forwarded-for; not
// spoof-proof (nothing in-memory can be), just enough to bucket abuse from
// a single source instead of nothing at all.
export function clientIp(req: Request | { headers: Headers }): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

/**
 * Convenience wrapper for route handlers: returns a 429 NextResponse when
 * over limit, or null when the caller should proceed.
 */
export function rateLimitResponse(routeName: string, req: Request, limit: number, windowMs: number) {
  const key = `${routeName}:${clientIp(req)}`
  const result = hit(key, limit, windowMs)
  if (result.allowed) return null
  const { NextResponse } = require('next/server')
  return NextResponse.json(
    { error: 'Too many requests — please try again shortly.' },
    { status: 429, headers: { 'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)) } }
  )
}
