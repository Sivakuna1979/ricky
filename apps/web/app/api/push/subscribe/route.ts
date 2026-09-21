// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getAuthedUserProfile, getOrCreateCustomerRecord } from '@/lib/customer/identity'

// POST /api/push/subscribe — J35/J37. Works for guests (order-specific
// "notify me when it's ready") and signed-in customers alike. business_id
// is required and is what J37's "Business A must never send push to
// Business B's customers" is actually enforced against at send time.
const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
  business_id: z.string().uuid(),
  van_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  const { endpoint, keys, business_id, van_id, order_id } = parsed.data

  const admin = await createAdminClient()

  // Validate the business/van/order actually exist and are related, so a
  // forged business_id can't be used to make this business "own" a
  // subscription it has no legitimate reason to send to.
  const { data: business } = await admin.from('businesses').select('id').eq('id', business_id).maybeSingle()
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  if (van_id) {
    const { data: van } = await admin.from('vans').select('id').eq('id', van_id).eq('business_id', business_id).maybeSingle()
    if (!van) return NextResponse.json({ error: 'Van not found for this business' }, { status: 404 })
  }
  if (order_id) {
    const { data: order } = await admin.from('orders').select('id, van_id').eq('id', order_id).maybeSingle()
    if (!order || (van_id && order.van_id !== van_id)) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  let customerId: string | null = null
  try {
    const supabase = await createClient()
    const profile = await getAuthedUserProfile(supabase)
    if (profile) customerId = (await getOrCreateCustomerRecord(admin, profile.userId))?.id ?? null
  } catch { /* guests can subscribe too */ }

  const { data, error } = await admin.from('push_subscriptions').upsert({
    endpoint, p256dh: keys.p256dh, auth_key: keys.auth,
    business_id, van_id: van_id ?? null, order_id: order_id ?? null,
    customer_id: customerId, user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
    last_seen_at: new Date().toISOString(), disabled_at: null,
  }, { onConflict: 'endpoint' }).select('id, notify_order_updates, notify_favourite_van_arrival, notify_favourite_stop_reminder, notify_loyalty_reward, notify_marketing_offers').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
