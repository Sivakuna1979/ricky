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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false },
  })
}

// Fields safe to expose to van owners before contact release
const PUBLIC_FIELDS = [
  'id', 'event_date', 'event_time', 'event_type', 'food_type',
  'event_location', 'num_guests', 'admin_status', 'foodtaxi_fee',
  'commission_pct', 'deposit_required', 'payment_required', 'urgent',
  'budget', 'notes', 'created_at',
]

export async function GET(req: NextRequest) {
  const db = getAdmin()
  const { data, error } = await db
    .from('event_requests')
    .select(PUBLIC_FIELDS.join(', '))
    .eq('marketplace_visible', true)
    .not('admin_status', 'in', '("completed","cancelled")')
    .order('event_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ opportunities: data ?? [] })
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
