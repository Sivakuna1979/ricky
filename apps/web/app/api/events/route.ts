// @ts-nocheck
/**
 * GET  /api/events  — public calendar (only admin-blocked dates; dates never blocked by other requests)
 * POST /api/events  — submit an event request (multiple per day are allowed — marketplace model)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'
  return createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false },
  })
}

export async function GET(req: NextRequest) {
  const db = getAdmin()
  const admin = req.nextUrl.searchParams.get('admin') === '1'

  if (admin) {
    const { data, error } = await db
      .from('event_requests')
      .select('*')
      .order('event_date', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ bookings: data ?? [] })
  }

  // Public: only blocked dates restrict the calendar — existing requests never block a date
  const [blockedRes, countsRes] = await Promise.all([
    db.from('event_blocked_dates').select('blocked_date, reason'),
    db.from('event_requests').select('event_date, admin_status').neq('admin_status', 'cancelled'),
  ])

  const dateCounts: Record<string, number> = {}
  ;(countsRes.data ?? []).forEach((r: any) => {
    dateCounts[r.event_date] = (dateCounts[r.event_date] ?? 0) + 1
  })

  return NextResponse.json({
    booked_dates: [],
    blocked_dates: (blockedRes.data ?? []).map((b: any) => ({ date: b.blocked_date, reason: b.reason })),
    date_counts: dateCounts,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const {
    name, phone, email, event_date, event_time, event_location,
    num_guests, notes, preferred_van, event_type, food_type, budget,
  } = body

  if (!name || !email || !event_date) {
    return NextResponse.json({ error: 'name, email and event_date are required' }, { status: 400 })
  }

  const db = getAdmin()

  // Only reject if admin explicitly blocked this date
  const { data: blocked } = await db
    .from('event_blocked_dates')
    .select('id')
    .eq('blocked_date', event_date)
    .maybeSingle()

  if (blocked) {
    return NextResponse.json({ error: 'FoodTaxi is not taking bookings on that date. Please choose another date.' }, { status: 409 })
  }

  const { data, error } = await db
    .from('event_requests')
    .insert({
      name, phone, email, event_date, event_time, event_location,
      num_guests: num_guests ? parseInt(num_guests) : null,
      notes, preferred_van,
      event_type: event_type || null,
      food_type: food_type || null,
      budget: budget || null,
      admin_status: 'new',
      customer_status: 'request_sent',
      marketplace_visible: false,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ error: 'Run the SQL migration first — event_requests table is missing.' }, { status: 500 })
    }
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    message: 'Your request has been received. FoodTaxi will find available vans and contact you.',
  })
}
