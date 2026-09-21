// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendPushToMany } from '@/lib/push/send'

export async function POST(req: NextRequest, { params }: { params: { vanId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: van, error } = await supabase
    .from('vans')
    .update({ tracking_status: 'live' })
    .eq('id', params.vanId)
    .select('name, slug')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // J34 — "favourite van is nearby/live" push, only to subscriptions
  // explicitly opted into this van's arrival notifications.
  try {
    const admin = await createAdminClient()
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_key')
      .eq('van_id', params.vanId)
      .eq('notify_favourite_van_arrival', true)
      .is('disabled_at', null)
    if (subs?.length) {
      const today = new Date().toISOString().slice(0, 10)
      await sendPushToMany(admin, subs, {
        title: `${van?.name ?? 'Your favourite van'} is live now! 🚐`,
        body: 'Order ahead now.',
        url: van?.slug ? `/van/${van.slug}` : '/',
        tag: `van-live-${params.vanId}`,
      }, `van_live:${params.vanId}:${today}`)
    }
  } catch (_e) { /* push failures must never block going live */ }

  return NextResponse.json({ status: 'live' })
}
