// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const { name, van_type, phone, description, business_id } = await req.json()
    if (!name) return NextResponse.json({ error: 'Van name is required' }, { status: 400 })
    if (!business_id) return NextResponse.json({ error: 'Business ID is required' }, { status: 400 })

    // Use session client so RLS sees the logged-in user
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    )

    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const slug = `${baseSlug}-${Date.now()}`

    const { data, error } = await supabase.from('vans').insert({
      name,
      slug,
      van_type:        van_type || null,
      phone:           phone || null,
      description:     description || null,
      business_id,
      tracking_status: 'offline',
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ van: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed' }, { status: 500 })
  }
}
