// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireCustomer } from '@/lib/customer/identity'

// J15 — favourite stops, keyed on van_schedule.id (Phase G's canonical
// stop-template identity), never on free-text pickup_location.
export async function GET() {
  const supabase = await createClient()
  const admin = await createAdminClient()
  const ctx = await requireCustomer(supabase, admin)
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data, error } = await admin
    .from('customer_favourite_stops')
    .select('stop_id, created_at, van_schedule(id, van_id, location_name, day_of_week, arrival_time, departure_time, vans(name, slug))')
    .eq('customer_id', ctx.customer.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ favourites: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const admin = await createAdminClient()
  const ctx = await requireCustomer(supabase, admin)
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { stop_id } = await req.json().catch(() => ({}))
  if (!stop_id) return NextResponse.json({ error: 'stop_id required' }, { status: 400 })

  // Verify the stop actually exists before allowing a favourite on it.
  const { data: stop } = await admin.from('van_schedule').select('id').eq('id', stop_id).maybeSingle()
  if (!stop) return NextResponse.json({ error: 'Stop not found' }, { status: 404 })

  const { error } = await admin.from('customer_favourite_stops').upsert(
    { customer_id: ctx.customer.id, stop_id },
    { onConflict: 'customer_id,stop_id' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const admin = await createAdminClient()
  const ctx = await requireCustomer(supabase, admin)
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const stop_id = searchParams.get('stop_id')
  if (!stop_id) return NextResponse.json({ error: 'stop_id required' }, { status: 400 })

  const { error } = await admin.from('customer_favourite_stops').delete().eq('customer_id', ctx.customer.id).eq('stop_id', stop_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
