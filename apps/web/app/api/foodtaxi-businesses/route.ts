// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return NextResponse.json([])

    const res = await fetch(
      `${url}/rest/v1/businesses?select=slug,postcode,name,business_type,city,vans(brand)&slug=not.is.null`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, cache: 'no-store' }
    )
    if (!res.ok) return NextResponse.json([])
    const data = await res.json()
    const list = (Array.isArray(data) ? data : []).map((b: any) => ({
      slug: b.slug,
      postcode: b.postcode,
      name: b.name,
      business_type: b.business_type,
      city: b.city,
      logo: (b.vans ?? []).find((v: any) => v?.brand?.logo)?.brand?.logo ?? null,
      lat: null,
      lng: null,
    }))

    // Geocode postcodes (free bulk lookup) so the homepage can sort by distance
    const pcs = [...new Set(list.map((b: any) => b.postcode).filter(Boolean))].slice(0, 100)
    if (pcs.length) {
      try {
        const geo = await fetch('https://api.postcodes.io/postcodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postcodes: pcs }),
        }).then(r => r.json())
        const coords: Record<string, any> = {}
        for (const r of geo?.result ?? []) {
          if (r?.result) coords[r.query] = { lat: r.result.latitude, lng: r.result.longitude }
        }
        for (const b of list) {
          const c = b.postcode ? coords[b.postcode] : null
          if (c) { b.lat = c.lat; b.lng = c.lng }
        }
      } catch {}
    }

    return NextResponse.json(list)
  } catch {
    return NextResponse.json([])
  }
}
