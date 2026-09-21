// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/analytics/funnel — J69. Business-authenticated (uses the
// cookie-scoped client so RLS's customer_events_business_read policy is
// the actual enforcement — a business can only ever see its own counts).
// Counts are exactly what was recorded (J69: "clearly define counts") —
// no estimation, no inference.
const FUNNEL_TYPES = ['menu_view', 'cart_start', 'checkout_start', 'order_completed']
const OTHER_TYPES = ['reorder_used', 'loyalty_wallet_view', 'install_prompt_shown', 'install_prompt_accepted', 'qr_scan']

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('business_id')
  const days = Math.min(90, Math.max(1, Number(searchParams.get('days') ?? 30)))
  if (!businessId) return NextResponse.json({ error: 'business_id required' }, { status: 400 })

  const since = new Date(Date.now() - days * 86400000).toISOString()
  const { data, error } = await supabase
    .from('customer_events')
    .select('event_type')
    .eq('business_id', businessId)
    .gte('created_at', since)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const counts: Record<string, number> = {}
  for (const type of [...FUNNEL_TYPES, ...OTHER_TYPES]) counts[type] = 0
  for (const row of data ?? []) if (counts[row.event_type] != null) counts[row.event_type]++

  return NextResponse.json({ days, funnel: FUNNEL_TYPES.map(t => ({ type: t, count: counts[t] })), other: OTHER_TYPES.map(t => ({ type: t, count: counts[t] })) })
}
