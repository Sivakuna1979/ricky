// @ts-nocheck
/**
 * GET    /api/events/blocked-dates      — list all blocked dates
 * POST   /api/events/blocked-dates      — block a date { date, reason }
 * DELETE /api/events/blocked-dates?id=  — unblock by row id
 */
import { NextRequest, NextResponse } from 'next/server'
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
  const { data, error } = await db.from('event_blocked_dates').select('*').order('blocked_date')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ blocked_dates: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const date   = body.date ?? body.blocked_date
  const reason = body.reason ?? null
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })
  const db = getAdmin()
  const { error } = await db
    .from('event_blocked_dates')
    .upsert({ blocked_date: date, reason }, { onConflict: 'blocked_date' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const id   = req.nextUrl.searchParams.get('id')
  const date = req.nextUrl.searchParams.get('date')
  const db = getAdmin()
  const { error } = id
    ? await db.from('event_blocked_dates').delete().eq('id', id)
    : await db.from('event_blocked_dates').delete().eq('blocked_date', date)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
