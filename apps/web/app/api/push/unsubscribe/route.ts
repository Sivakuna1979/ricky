// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/push/unsubscribe — the endpoint URL itself (a long random,
// push-service-issued value) is the only credential needed, same
// unguessable-token trust model used elsewhere in the app (order/receipt
// ids). Deletes rather than just disabling — an explicit unsubscribe
// should actually remove the row (J35).
export async function POST(req: NextRequest) {
  const { endpoint } = await req.json().catch(() => ({}))
  if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 })

  const admin = await createAdminClient()
  await admin.from('push_subscriptions').delete().eq('endpoint', endpoint)
  return NextResponse.json({ ok: true })
}
