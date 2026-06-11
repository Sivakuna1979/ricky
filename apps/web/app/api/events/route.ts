// @ts-nocheck
/**
 * GET  /api/events               — list upcoming bookings (public: just dates)
 * POST /api/events               — submit a booking request
 *
 * Required Supabase table:
 * create table if not exists event_bookings (
 *   id uuid primary key default gen_random_uuid(),
 *   name text not null,
 *   phone text,
 *   email text not null,
 *   event_date date not null,
 *   event_time text,
 *   event_location text,
 *   num_guests integer,
 *   notes text,
 *   preferred_van text,
 *   status text default 'pending',
 *   assigned_van_id uuid,
 *   created_at timestamptz default now()
 * );
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

export async function GET(req: NextRequest) {
  const db = getAdmin()
  const admin = req.nextUrl.searchParams.get('admin') === '1'

  if (admin) {
    const { data, error } = await db
      .from('event_bookings')
      .select('*')
      .order('event_date', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ bookings: data ?? [] })
  }

  // Public: return only booked dates (accepted + pending) and blocked dates
  const [bookings, blocked] = await Promise.all([
    db.from('event_bookings').select('event_date, status').in('status', ['pending','accepted']),
    db.from('event_blocked_dates').select('blocked_date, reason'),
  ])

  const bookedDates  = (bookings.data ?? []).map((b: any) => b.event_date)
  const blockedDates = (blocked.data ?? []).map((b: any) => ({ date: b.blocked_date, reason: b.reason }))

  return NextResponse.json({ booked_dates: bookedDates, blocked_dates: blockedDates })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { name, phone, email, event_date, event_time, event_location, num_guests, notes, preferred_van } = body

  if (!name || !email || !event_date) {
    return NextResponse.json({ error: 'name, email and event_date are required' }, { status: 400 })
  }

  const db = getAdmin()

  // Check if date is blocked or already booked
  const [blocked, existing] = await Promise.all([
    db.from('event_blocked_dates').select('id').eq('blocked_date', event_date).maybeSingle(),
    db.from('event_bookings').select('id').eq('event_date', event_date).in('status', ['pending','accepted']).maybeSingle(),
  ])

  if (blocked.data) return NextResponse.json({ error: 'That date is not available. Please choose another date.' }, { status: 409 })
  if (existing.data) return NextResponse.json({ error: 'That date already has a booking. Please choose another date.' }, { status: 409 })

  const { data, error } = await db
    .from('event_bookings')
    .insert({ name, phone, email, event_date, event_time, event_location, num_guests: num_guests ? parseInt(num_guests) : null, notes, preferred_van, status: 'pending' })
    .select('id')
    .single()

  if (error) {
    if (error.message.includes('event_bookings') || error.message.includes('relation')) {
      return NextResponse.json({
        error: 'Run the SQL migration first.',
        sql: `create table if not exists event_bookings (id uuid primary key default gen_random_uuid(), name text not null, phone text, email text not null, event_date date not null, event_time text, event_location text, num_guests integer, notes text, preferred_van text, status text default 'pending', assigned_van_id uuid, created_at timestamptz default now());\ncreate table if not exists event_blocked_dates (id uuid primary key default gen_random_uuid(), blocked_date date not null unique, reason text, created_at timestamptz default now());`,
      }, { status: 500 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.id, message: 'Booking request submitted! We will contact you within 24 hours to confirm.' })
}
