// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function getAdmin() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    { cookies: { getAll: () => [], setAll: () => {} }, auth: { persistSession: false } }
  )
}

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const db = getAdmin()

    const { data: business } = await db
      .from('businesses')
      .select('id, name, slug, business_type, phone, email, website, postcode, city, address')
      .eq('slug', params.slug)
      .maybeSingle()

    if (!business) return NextResponse.json({ business: null }, { status: 404 })

    const { data: vans } = await db
      .from('vans')
      .select('id, name, van_type, tracking_status, lat, lng, phone, description')
      .eq('business_id', business.id)

    const vanIds = (vans ?? []).map((v: any) => v.id)
    let menuItems: any[] = []
    if (vanIds.length > 0) {
      const { data: items } = await db
        .from('menu_items')
        .select('id, name, description, price, category, available, van_id')
        .in('van_id', vanIds)
        .eq('available', true)
        .order('category')
      menuItems = items ?? []
    }

    return NextResponse.json({ business, vans: vans ?? [], menuItems })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
