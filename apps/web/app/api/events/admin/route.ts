// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAIL = 'sivakuna@icloud.com'

// FoodTaxi staff add events sourced around the UK straight onto the van board.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { event_date, event_time, event_type, food_type, event_location, region, postcode, num_guests, budget, notes, foodtaxi_fee, urgent } = body
  if (!event_date || !event_location) {
    return NextResponse.json({ error: 'event_date and event_location are required' }, { status: 400 })
  }

  // Geocode the postcode (free, no key) so vans can search by distance
  let lat = null, lng = null
  if (postcode?.trim()) {
    try {
      const geo = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.trim())}`).then(r => r.json())
      if (geo?.result) { lat = geo.result.latitude; lng = geo.result.longitude }
    } catch {}
  }

  const admin = await createAdminClient()
  const { data, error } = await admin.from('event_requests').insert({
    name: 'FoodTaxi Events Team',
    email: SUPER_ADMIN_EMAIL,
    event_date,
    event_time: event_time || null,
    event_type: event_type || 'festival',
    food_type: food_type || 'any',
    event_location,
    region: region || null,
    postcode: postcode?.trim() || null,
    lat, lng,
    num_guests: num_guests ? parseInt(num_guests) : null,
    budget: budget || null,
    notes: notes || null,
    foodtaxi_fee: foodtaxi_fee ?? 29.99,
    urgent: !!urgent,
    source: 'foodtaxi',
    admin_status: 'published',
    marketplace_visible: true,
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
}
