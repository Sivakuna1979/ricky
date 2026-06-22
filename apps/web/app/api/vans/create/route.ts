// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  return createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false },
  })
}

export async function POST(req: NextRequest) {
  try {
    const { name, van_type, phone, description, business_id } = await req.json()
    if (!name) return NextResponse.json({ error: 'Van name is required' }, { status: 400 })
    if (!business_id) return NextResponse.json({ error: 'Business ID is required' }, { status: 400 })

    const admin = getAdmin()
    const { data, error } = await admin.from('vans').insert({
      name,
      van_type,
      phone: phone || null,
      description: description || null,
      business_id,
      tracking_status: 'offline',
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ van: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed' }, { status: 500 })
  }
}
