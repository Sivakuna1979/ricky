// @ts-nocheck
// Phase N — readiness/health check. Deliberately minimal: confirms the DB
// is reachable and returns fast, and never leaks secrets, env values, or
// a version string an attacker could use for fingerprinting. Intended for
// Vercel/uptime-monitor pings, not a diagnostics endpoint.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = Date.now()
  try {
    const admin = await createAdminClient()
    const { error } = await admin.from('businesses').select('id').limit(1)
    if (error) throw error
    return NextResponse.json({ status: 'ok', db: 'reachable', latencyMs: Date.now() - startedAt })
  } catch {
    return NextResponse.json({ status: 'error', db: 'unreachable' }, { status: 503 })
  }
}
