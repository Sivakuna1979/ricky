// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false },
  })
}

// Haversine distance in km
function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat    = parseFloat(searchParams.get('lat') ?? '0')
  const lng    = parseFloat(searchParams.get('lng') ?? '0')
  const radius = parseFloat(searchParams.get('radius') ?? '5') // km

  if (!lat || !lng) return NextResponse.json({ error: 'lat/lng required' }, { status: 400 })

  const db = getAdmin()

  // Bounding box for fast pre-filter (1 degree lat ≈ 111 km)
  const deg = radius / 111
  const latMin = lat - deg, latMax = lat + deg
  const lngMin = lng - deg, lngMax = lng + deg

  const [liveRes, bizRes, importedRes, discoveredRes] = await Promise.all([
    // Live vans with location
    db.from('live_locations')
      .select('*, vans!inner(id, name, van_type, tracking_status, slug, phone, business_id)')
      .eq('vans.tracking_status', 'live')
      .gte('latitude', latMin).lte('latitude', latMax)
      .gte('longitude', lngMin).lte('longitude', lngMax)
      .order('recorded_at', { ascending: false })
      .limit(100),

    // Registered businesses with location
    db.from('businesses')
      .select('id, name, van_type, slug, phone, email, address, postcode, city, latitude, longitude, status')
      .eq('status', 'active')
      .not('latitude', 'is', null)
      .gte('latitude', latMin).lte('latitude', latMax)
      .gte('longitude', lngMin).lte('longitude', lngMax),

    // Imported local businesses
    db.from('imported_businesses')
      .select('*')
      .not('latitude', 'is', null)
      .gte('latitude', latMin).lte('latitude', latMax)
      .gte('longitude', lngMin).lte('longitude', lngMax)
      .limit(100),

    // Discovered businesses (OSM + Google Places + manual)
    db.from('discovered_businesses')
      .select('id, name, address, postcode, lat, lng, phone, website, business_type, source, status, google_place_id, rating')
      .neq('status', 'hidden')
      .neq('status', 'converted')
      .not('lat', 'is', null)
      .gte('lat', latMin).lte('lat', latMax)
      .gte('lng', lngMin).lte('lng', lngMax)
      .limit(200),
  ])

  // Filter by actual radius & deduplicate
  const filter = (items: any[], getCoords: (i: any) => [number, number]) =>
    (items ?? []).filter(i => {
      const [ilat, ilng] = getCoords(i)
      return ilat && ilng && haversine(lat, lng, ilat, ilng) <= radius
    })

  const liveVans     = filter(liveRes.data ?? [],      i => [i.latitude, i.longitude])
  const businesses   = filter(bizRes.data ?? [],       i => [i.latitude, i.longitude])
  const imported     = filter(importedRes.data ?? [],  i => [i.latitude, i.longitude])
  const discovered   = filter(discoveredRes.data ?? [], i => [i.lat, i.lng])

  // Deduplicate imported vs discovered by name similarity
  const importedNames = new Set(imported.map((b: any) => b.name?.toLowerCase().trim()))
  const dedupedDiscovered = discovered.filter((d: any) =>
    !importedNames.has(d.name?.toLowerCase().trim())
  )

  return NextResponse.json({
    live_vans:   liveVans,
    businesses,
    imported,
    discovered:  dedupedDiscovered,
    centre:      { lat, lng, radius },
  })
}
