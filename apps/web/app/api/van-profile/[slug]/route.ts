// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'

async function supabaseGet(path: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const data = await res.json()
  return Array.isArray(data) ? data : data
}

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const slug = encodeURIComponent(params.slug)

    const bizArr = await supabaseGet(
      `businesses?select=*&slug=eq.${slug}&limit=1`
    )
    const business = Array.isArray(bizArr) ? bizArr[0] : null
    if (!business) return NextResponse.json({ business: null }, { status: 404 })

    const vans = await supabaseGet(
      `vans?select=*&business_id=eq.${business.id}`
    ) ?? []

    const vanIds = vans.map((v: any) => v.id)
    let menuItems: any[] = []
    if (vanIds.length > 0) {
      const inClause = `(${vanIds.join(',')})`
      menuItems = await supabaseGet(
        `menu_items?select=*&van_id=in.${inClause}&available=eq.true&order=category`
      ) ?? []
    }

    return NextResponse.json({ business, vans, menuItems })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
