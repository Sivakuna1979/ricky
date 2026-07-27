// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'

// A van pinging its GPS less often than this counts as stale — fall back to
// the business's registered address rather than show a frozen live pin.
const LIVE_STALE_MS = 5 * 60 * 1000

export async function GET(_req: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return NextResponse.json([])
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

    const res = await fetch(
      `${url}/rest/v1/businesses?select=slug,postcode,name,business_type,city,vans(id,tracking_status,brand)&slug=not.is.null`,
      { headers, cache: 'no-store' }
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
      liveVanId: (b.vans ?? []).find((v: any) => v?.tracking_status === 'live')?.id ?? null,
      lat: null,
      lng: null,
      isLive: false,
    }))

    // Prefer a van's actual live GPS position over the registered address —
    // a business trading live nearby should show its real distance, not
    // wherever it's registered, or a customer could miss it as "far away"
    // when it's actually round the corner.
    const liveVanIds = [...new Set(list.map((b: any) => b.liveVanId).filter(Boolean))]
    if (liveVanIds.length) {
      try {
        const inList = liveVanIds.map((id: string) => `"${id}"`).join(',')
        const locs = await fetch(
          `${url}/rest/v1/live_locations?van_id=in.(${inList})&select=van_id,latitude,longitude,recorded_at&order=recorded_at.desc`,
          { headers, cache: 'no-store' }
        ).then(r => r.json())
        const latestByVan: Record<string, any> = {}
        for (const l of Array.isArray(locs) ? locs : []) {
          if (!latestByVan[l.van_id]) latestByVan[l.van_id] = l // first hit per van = most recent, already sorted desc
        }
        for (const b of list) {
          const loc = b.liveVanId ? latestByVan[b.liveVanId] : null
          if (loc && Date.now() - new Date(loc.recorded_at).getTime() < LIVE_STALE_MS) {
            b.lat = loc.latitude
            b.lng = loc.longitude
            b.isLive = true
          }
        }
      } catch {}
    }

    // Geocode postcodes (free bulk lookup) for whichever businesses don't
    // have a live position, so the homepage can still sort them by distance.
    const needsGeocode = list.filter((b: any) => !b.isLive)
    const pcs = [...new Set(needsGeocode.map((b: any) => b.postcode).filter(Boolean))].slice(0, 100)
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
        for (const b of needsGeocode) {
          const c = b.postcode ? coords[b.postcode] : null
          if (c) { b.lat = c.lat; b.lng = c.lng }
        }
      } catch {}
    }

    return NextResponse.json(list.map(({ liveVanId, ...b }: any) => b))
  } catch {
    return NextResponse.json([])
  }
}
