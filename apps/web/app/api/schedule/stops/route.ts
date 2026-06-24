// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

async function sbReq(path: string, method: string, body?: any) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(Array.isArray(data) ? data[0]?.message : (data?.message ?? text ?? `HTTP ${res.status}`))
  return data
}

export async function POST(req: NextRequest) {
  try {
    const { van_id, stops } = await req.json()
    if (!van_id) return NextResponse.json({ error: 'van_id required' }, { status: 400 })
    if (!stops?.length) return NextResponse.json({ error: 'No stops provided' }, { status: 400 })

    const rows = stops.map((s: any) => ({
      van_id,
      day_of_week: s.day_of_week,
      location_name: s.location_name,
      arrival_time: s.arrival_time ?? '16:30',
      departure_time: s.departure_time ?? '20:30',
      notes: s.notes ?? '',
      sort_order: s.sort_order ?? 0,
    }))

    const data = await sbReq('van_schedule', 'POST', rows)
    return NextResponse.json({ ok: true, inserted: Array.isArray(data) ? data.length : 1 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to save' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await sbReq(`van_schedule?id=eq.${id}`, 'DELETE')
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to delete' }, { status: 500 })
  }
}
