// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// PATCH /api/push/preferences — J36. The endpoint is the subscription's
// own credential (see unsubscribe's comment); no other auth is layered on
// top since anyone who has it already controls that browser's
// subscription. Marketing is always a separate, explicit toggle from
// order_updates — never bundled.
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { endpoint, ...prefs } = body
  if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 })

  const allowed = ['notify_order_updates', 'notify_favourite_van_arrival', 'notify_favourite_stop_reminder', 'notify_loyalty_reward', 'notify_marketing_offers']
  const updates: any = {}
  for (const key of allowed) if (typeof prefs[key] === 'boolean') updates[key] = prefs[key]
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'No valid preference fields' }, { status: 400 })

  const admin = await createAdminClient()
  const { error } = await admin.from('push_subscriptions').update(updates).eq('endpoint', endpoint)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
