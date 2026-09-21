// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/push/resubscribe — called by the service worker's
// pushsubscriptionchange handler when the browser silently rotates a
// subscription. Best-effort: just marks the old endpoint disabled so it
// stops being sent to; the browser will re-register a fresh subscription
// via the normal /api/push/subscribe flow on next use.
export async function POST(req: NextRequest) {
  const { oldEndpoint } = await req.json().catch(() => ({}))
  if (!oldEndpoint) return NextResponse.json({ ok: true })

  const admin = await createAdminClient()
  await admin.from('push_subscriptions').update({ disabled_at: new Date().toISOString() }).eq('endpoint', oldEndpoint)
  return NextResponse.json({ ok: true })
}
