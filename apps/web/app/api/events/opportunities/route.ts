// @ts-nocheck
/**
 * GET /api/events/opportunities
 * Van owner event board — returns marketplace-visible events WITHOUT customer contact details.
 * Contact details are only released after admin approval via event_applications.
 *
 * POST /api/events/opportunities
 * Van owner expresses interest or accepts an event opportunity.
 * Body: { event_id, van_owner_name, van_owner_email, business_name, action: 'interested'|'accept'|'decline'|'question', notes }
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

// Fields safe to expose to van owners before contact release
const PUBLIC_FIELDS = [
  'id', 'event_date', 'event_time', 'event_type', 'food_type',
  'event_location', 'region', 'postcode', 'lat', 'lng', 'num_guests', 'admin_status', 'foodtaxi_fee',
  'commission_pct', 'deposit_required', 'payment_required', 'urgent',
  'budget', 'notes', 'created_at',
]

const milesBetween = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const toRad = (d: number) => d * Math.PI / 180
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2
  return 3959 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function GET(req: NextRequest) {
  const db = getAdmin()
  const p = req.nextUrl.searchParams

  let query = db
    .from('event_requests')
    .select(PUBLIC_FIELDS.join(', '))
    .eq('marketplace_visible', true)
    .not('admin_status', 'in', '("completed","cancelled")')
    .gte('event_date', new Date().toISOString().slice(0, 10))

  // UK-wide filters for the van board
  if (p.get('region')) query = query.eq('region', p.get('region'))
  if (p.get('food_type')) query = query.in('food_type', [p.get('food_type'), 'any'])
  if (p.get('type')) query = query.eq('event_type', p.get('type'))
  if (p.get('q')) query = query.ilike('event_location', `%${p.get('q')}%`)
  if (p.get('from')) query = query.gte('event_date', p.get('from'))
  if (p.get('to')) query = query.lte('event_date', p.get('to'))

  // Priority events first, then soonest
  let { data, error } = await query
    .order('urgent', { ascending: false })
    .order('event_date', { ascending: true })
    .limit(200)

  // New columns not migrated yet — retry without them so the board still works
  if (error && /(region|postcode|lat|lng|column)/i.test(error.message ?? '')) {
    const NEW_COLS = ['region', 'postcode', 'lat', 'lng']
    const retry = await db
      .from('event_requests')
      .select(PUBLIC_FIELDS.filter(f => !NEW_COLS.includes(f)).join(', '))
      .eq('marketplace_visible', true)
      .not('admin_status', 'in', '("completed","cancelled")')
      .gte('event_date', new Date().toISOString().slice(0, 10))
      .order('urgent', { ascending: false })
      .order('event_date', { ascending: true })
      .limit(200)
    data = retry.data
    error = retry.error
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Postcode proximity: geocode the searcher's postcode and sort by distance
  let opportunities = data ?? []
  const searchPc = p.get('postcode')?.trim()
  if (searchPc) {
    try {
      const geo = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(searchPc)}`).then(r => r.json())
      if (geo?.result) {
        const { latitude, longitude } = geo.result
        const radius = Number(p.get('radius')) || 0 // 0 = anywhere, still sorted by distance
        opportunities = opportunities
          .map((o: any) => ({
            ...o,
            distance_miles: o.lat != null && o.lng != null ? Math.round(milesBetween(latitude, longitude, o.lat, o.lng) * 10) / 10 : null,
          }))
          .filter((o: any) => !radius || (o.distance_miles != null && o.distance_miles <= radius))
          .sort((a: any, b: any) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || (a.distance_miles ?? 1e9) - (b.distance_miles ?? 1e9))
      }
    } catch {}
  }

  return NextResponse.json({ opportunities })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { event_id, van_owner_name, van_owner_email, business_name, action, notes } = body

  if (!event_id || !van_owner_email || !action) {
    return NextResponse.json({ error: 'event_id, van_owner_email and action required' }, { status: 400 })
  }

  const db = getAdmin()

  // Verify event is still visible
  const { data: evt } = await db
    .from('event_requests')
    .select('id, admin_status, marketplace_visible')
    .eq('id', event_id)
    .single()

  if (!evt?.marketplace_visible) {
    return NextResponse.json({ error: 'This opportunity is no longer available.' }, { status: 404 })
  }

  const status = action === 'accept' ? 'accepted_pending_payment' : action === 'decline' ? 'declined' : 'interested'

  // Upsert application (one per van email per event)
  const { error } = await db
    .from('event_applications')
    .upsert({
      event_id,
      van_owner_name: van_owner_name ?? null,
      van_owner_email,
      business_name: business_name ?? null,
      status,
      notes: notes ?? null,
    }, { onConflict: 'event_id,van_owner_email' })

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ error: 'Run SQL migration first — event_applications table is missing.' }, { status: 500 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If van expressed interest, bump admin_status to vans_interested
  if (action === 'interested' && evt.admin_status === 'published') {
    await db.from('event_requests').update({ admin_status: 'vans_interested' }).eq('id', event_id)
  }

  return NextResponse.json({ ok: true, status })
}
