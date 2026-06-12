// @ts-nocheck
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

// GET: list all imported businesses
export async function GET() {
  const db = getAdmin()
  const { data, error } = await db
    .from('imported_businesses')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST: add single or array of businesses
export async function POST(req: NextRequest) {
  const db = getAdmin()
  const body = await req.json()
  const rows = Array.isArray(body) ? body : [body]

  const cleaned = rows.map(r => ({
    name:          r.name,
    food_type:     r.food_type ?? r.business_type ?? 'food_business',
    description:   r.description ?? null,
    address:       r.address ?? null,
    postcode:      r.postcode ?? null,
    latitude:      r.latitude ?? r.lat ?? null,
    longitude:     r.longitude ?? r.lng ?? null,
    phone:         r.phone ?? null,
    website:       r.website ?? null,
    source:        r.source ?? 'manual',
    is_registered: false,
    is_live:       false,
    status:        r.status ?? 'active',
  }))

  const { data, error } = await db
    .from('imported_businesses')
    .upsert(cleaned, { onConflict: 'name,postcode', ignoreDuplicates: true })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, inserted: data?.length ?? 0 })
}

// PATCH: update status (hide, convert)
export async function PATCH(req: NextRequest) {
  const db = getAdmin()
  const { id, status } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { error } = await db.from('imported_businesses').update({ status }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
