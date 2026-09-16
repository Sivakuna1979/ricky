// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getOwnedBusiness } from '@/lib/getOwnedBusiness'

// GET /api/marketing/audience — how many past customers the owner could
// email right now: distinct addresses from their own orders, minus anyone
// who's unsubscribed.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const biz = await getOwnedBusiness(supabase, user.id)
  if (!biz) return NextResponse.json({ count: 0 })

  const admin = await createAdminClient()
  const { data: vans } = await admin.from('vans').select('id').eq('business_id', biz.id)
  const vanIds = (vans ?? []).map((v: any) => v.id)
  if (!vanIds.length) return NextResponse.json({ count: 0 })

  const { data: orders } = await admin
    .from('orders')
    .select('guest_email')
    .in('van_id', vanIds)
    .not('guest_email', 'is', null)

  const { data: unsubs } = await admin.from('email_unsubscribes').select('email')
  const unsubscribed = new Set((unsubs ?? []).map((u: any) => u.email.toLowerCase()))

  const emails = new Set(
    (orders ?? [])
      .map((o: any) => (o.guest_email ?? '').trim().toLowerCase())
      .filter((e: string) => e && !unsubscribed.has(e))
  )

  return NextResponse.json({ count: emails.size })
}
