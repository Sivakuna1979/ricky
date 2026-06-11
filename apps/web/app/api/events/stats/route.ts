// @ts-nocheck
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
    .from('event_bookings')
    .select('id, status, event_date, total_amount, deposit_amount, deposit_paid, created_at')

  const rows = all ?? []
  const now = new Date()

  return NextResponse.json({
    total:            rows.length,
    today:            rows.filter(r => r.event_date === today).length,
    this_month:       rows.filter(r => r.event_date >= monthStart).length,
    pending:          rows.filter(r => ['new','contacted','quote_sent','awaiting_deposit'].includes(r.status)).length,
    confirmed:        rows.filter(r => ['confirmed','assigned'].includes(r.status)).length,
    completed:        rows.filter(r => r.status === 'completed').length,
    cancelled:        rows.filter(r => r.status === 'cancelled').length,
    revenue_month:    rows.filter(r => r.event_date >= monthStart && r.status !== 'cancelled').reduce((s,r) => s + (r.total_amount ?? 0), 0),
    deposits_pending: rows.filter(r => r.status === 'awaiting_deposit' && !r.deposit_paid).length,
  })
}
