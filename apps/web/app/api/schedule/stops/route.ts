// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAIL = 'sivakuna@icloud.com'

// Verify the signed-in user owns (or is admin for) the given van.
// Returns { supabase } on success, or { error } as a NextResponse to return early.
async function authorizeVan(vanId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Please sign in to edit the schedule.' }, { status: 401 }) }
  }

  if (user.email === SUPER_ADMIN_EMAIL) return { supabase }

  // Confirm ownership: van -> business -> owner, matched to the users row.
  const { data: userRow } = await supabase
    .from('users').select('id').eq('auth_id', user.id).single()
  const { data: van } = await supabase
    .from('vans').select('id, businesses!inner(owner_id)').eq('id', vanId).single()

  const ownerId = (van as any)?.businesses?.owner_id
  if (!van || !userRow || ownerId !== userRow.id) {
    return { error: NextResponse.json({ error: 'You do not have permission to edit this van.' }, { status: 403 }) }
  }
  return { supabase }
}

export async function POST(req: NextRequest) {
  try {
    const { van_id, stops } = await req.json()
    if (!van_id) return NextResponse.json({ error: 'van_id required' }, { status: 400 })
    if (!stops?.length) return NextResponse.json({ error: 'No stops provided' }, { status: 400 })

    const { supabase, error } = await authorizeVan(van_id)
    if (error) return error

    const rows = stops.map((s: any) => ({
      van_id,
      day_of_week: s.day_of_week,
      location_name: s.location_name,
      arrival_time: s.arrival_time ?? '16:30',
      departure_time: s.departure_time ?? '20:30',
      notes: s.notes ?? '',
      sort_order: s.sort_order ?? 0,
    }))

    const { error: insErr } = await supabase.from('van_schedule').insert(rows)
    if (insErr) throw new Error(insErr.message)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to save' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // Look up the stop's van so we can authorize against it.
    const base = await createClient()
    const { data: stop } = await base.from('van_schedule').select('van_id').eq('id', id).single()
    if (!stop) return NextResponse.json({ error: 'Stop not found' }, { status: 404 })

    const { supabase, error } = await authorizeVan(stop.van_id)
    if (error) return error

    const { error: delErr } = await supabase.from('van_schedule').delete().eq('id', id)
    if (delErr) throw new Error(delErr.message)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to delete' }, { status: 500 })
  }
}
