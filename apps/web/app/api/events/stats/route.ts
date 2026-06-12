// @ts-nocheck
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'
  return createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false },
  })
}

export async function GET() {
  const db = getAdmin()
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'

  const { data: all } = await db
    .from('event_requests')
    .select('id, admin_status, event_date, total_amount, deposit_amount, deposit_paid, created_at, marketplace_visible, foodtaxi_fee')

  const rows = all ?? []

  return NextResponse.json({
    total:             rows.length,
    today:             rows.filter(r => r.event_date === today).length,
    this_month:        rows.filter(r => r.event_date >= monthStart).length,
    new:               rows.filter(r => r.admin_status === 'new').length,
    reviewing:         rows.filter(r => r.admin_status === 'reviewing').length,
    published:         rows.filter(r => r.admin_status === 'published').length,
    vans_interested:   rows.filter(r => r.admin_status === 'vans_interested').length,
    confirmed:         rows.filter(r => r.admin_status === 'confirmed').length,
    completed:         rows.filter(r => r.admin_status === 'completed').length,
    cancelled:         rows.filter(r => r.admin_status === 'cancelled').length,
    pending_review:    rows.filter(r => ['new','reviewing'].includes(r.admin_status)).length,
    revenue_month:     rows.filter(r => r.event_date >= monthStart && r.admin_status !== 'cancelled').reduce((s, r) => s + (r.foodtaxi_fee ?? 0), 0),
    deposits_pending:  rows.filter(r => r.admin_status === 'awaiting_deposit' && !r.deposit_paid).length,
    marketplace_live:  rows.filter(r => r.marketplace_visible).length,
  })
}
