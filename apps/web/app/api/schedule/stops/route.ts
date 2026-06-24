// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { van_id, stops } = await req.json()
    if (!van_id) return NextResponse.json({ error: 'van_id required' }, { status: 400 })
    if (!stops?.length) return NextResponse.json({ error: 'No stops provided' }, { status: 400 })

    const supabase = await createAdminClient()
    const rows = stops.map((s: any) => ({
      van_id,
      day_of_week: s.day_of_week,
      location_name: s.location_name,
      arrival_time: s.arrival_time ?? '16:30',
      departure_time: s.departure_time ?? '20:30',
      notes: s.notes ?? '',
      sort_order: s.sort_order ?? 0,
    }))

    const { error } = await supabase.from('van_schedule').insert(rows)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to save' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const supabase = await createAdminClient()
    const { error } = await supabase.from('van_schedule').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to delete' }, { status: 500 })
  }
}
