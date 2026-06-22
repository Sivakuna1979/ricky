// @ts-nocheck
/**
 * Secure server-side Google Places discovery.
 * GOOGLE_PLACES_API_KEY is never sent to the client.
 * GET /api/places/nearby?lat=51.35&lng=-0.30&radius=8000
 *
 * Auto-expands radius: 5 → 10 → 25 → 50 → 100 miles if < 5 results found.
 * Auto-saves every result to discovered_businesses (upsert on google_place_id).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const KEYWORDS = [
  'food truck',
  'food van',
  'mobile catering',
  'fish and chips',
  'fish and chip van',
  'burger van',
  'coffee van',
  'mobile food',
  'street food',
  'catering company',
  'event catering',
  'pizza van',
  'ice cream van',
  'kebab van',
  'burger truck',
  'mobile food van',
  'catering van',
]

// Radii in metres: 5 → 10 → 25 → 50 → 100 miles
const RADII = [8047, 16093, 40234, 80467, 160934]

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'
  return createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false },
  })
}

function inferType(name: string, types: string[]): string {
  const n = (name ?? '').toLowerCase()
  if (n.includes('fish') || n.includes('chip'))              return 'fish_and_chips'
  if (n.includes('burger') || n.includes('grill'))           return 'burger'
  if (n.includes('pizza'))                                   return 'pizza'
  if (n.includes('coffee') || n.includes('café') || n.includes('cafe')) return 'coffee'
  if (n.includes('ice cream') || n.includes('gelato'))       return 'ice_cream'
  if (n.includes('kebab') || n.includes('doner'))            return 'kebab'
  if (n.includes('taco') || n.includes('burrito'))           return 'street_food'
  if (n.includes('crepe') || n.includes('waffle'))           return 'dessert'
  if (n.includes('catering') || n.includes('event'))        return 'catering_trailer'
  if (types?.includes('bakery'))                             return 'bakery'
  return 'fast_food'
}

async function searchRadius(apiKey: string, lat: number, lng: number, radius: number): Promise<Map<string, any>> {
  const seen = new Map<string, any>()
  await Promise.allSettled(
    KEYWORDS.map(async (keyword) => {
      try {
        const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
        url.searchParams.set('query', keyword)
        url.searchParams.set('location', `${lat},${lng}`)
        url.searchParams.set('radius', String(radius))
        url.searchParams.set('key', apiKey)
        const res = await fetch(url.toString(), { next: { revalidate: 1800 } })
        const data = await res.json()
        if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
          for (const place of data.results ?? []) {
            if (!seen.has(place.place_id)) seen.set(place.place_id, place)
          }
        }
      } catch {}
    })
  )
  return seen
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      error: 'GOOGLE_PLACES_API_KEY not set in Vercel environment variables.',
      results: [],
    }, { status: 503 })
  }

  const { searchParams } = req.nextUrl
  const lat    = parseFloat(searchParams.get('lat') ?? '')
  const lng    = parseFloat(searchParams.get('lng') ?? '')
  const forceRadius = searchParams.get('radius') ? parseInt(searchParams.get('radius')!) : null

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng required', results: [] }, { status: 400 })
  }

  let seen = new Map<string, any>()
  let usedRadius = forceRadius ?? RADII[0]

  if (forceRadius) {
    seen = await searchRadius(apiKey, lat, lng, forceRadius)
  } else {
    // Auto-expand radius until we have at least 5 results
    for (const r of RADII) {
      seen = await searchRadius(apiKey, lat, lng, r)
      usedRadius = r
      if (seen.size >= 5) break
    }
  }

  const results = Array.from(seen.values()).map((place) => {
    const loc = place.geometry?.location ?? {}
    const postcodeMatch = (place.formatted_address ?? '').match(/[A-Z]{1,2}\d[\dA-Z]?\s*\d[A-Z]{2}/i)
    return {
      place_id:      place.place_id,
      name:          place.name,
      address:       place.formatted_address ?? '',
      postcode:      postcodeMatch?.[0]?.toUpperCase() ?? null,
      lat:           loc.lat ?? null,
      lng:           loc.lng ?? null,
      rating:        place.rating ?? null,
      total_ratings: place.user_ratings_total ?? 0,
      open_now:      place.opening_hours?.open_now ?? null,
      food_type:     inferType(place.name, place.types ?? []),
      types:         place.types ?? [],
      source:        'google_places',
    }
  })

  // Enrich results with FoodTaxi slug — match by postcode OR name similarity
  const uniquePostcodes = [...new Set(results.map(r => r.postcode).filter(Boolean))]
  const slugMap      = new Map<string, string>()  // postcode → slug
  const nameSlugMap  = new Map<string, string>()  // normalised name → slug
  try {
    const db2 = getAdmin()
    const { data: registered } = await db2
      .from('businesses')
      .select('slug, postcode, name')
    for (const b of registered ?? []) {
      if (b.postcode && b.slug) slugMap.set(b.postcode.trim().toUpperCase(), b.slug)
      if (b.name && b.slug) {
        const key = b.name.toLowerCase().replace(/[^a-z0-9]/g, '')
        nameSlugMap.set(key, b.slug)
      }
    }
  } catch {}

  function nameMatch(googleName: string): string | null {
    const gKey = googleName.toLowerCase().replace(/[^a-z0-9]/g, '')
    for (const [key, slug] of nameSlugMap) {
      // Match if either contains the other (min 6 chars)
      if (key.length >= 6 && gKey.length >= 6 && (gKey.includes(key) || key.includes(gKey))) return slug
    }
    return null
  }

  const enriched = results.map(r => ({
    ...r,
    foodtaxi_slug: (r.postcode ? slugMap.get(r.postcode.trim().toUpperCase()) : null)
                   ?? nameMatch(r.name)
                   ?? null,
  }))

  // Auto-save to discovered_businesses (fire-and-forget — don't block response)
  const db = getAdmin()
  const rows = results
    .filter(r => r.lat != null && r.lng != null)
    .map(r => ({
      name:            r.name,
      address:         r.address,
      postcode:        r.postcode,
      lat:             r.lat,
      lng:             r.lng,
      business_type:   r.food_type,
      source:          'google_places',
      google_place_id: r.place_id,
      rating:          r.rating,
      status:          'discovered',
    }))

  db.from('discovered_businesses')
    .upsert(rows, { onConflict: 'google_place_id', ignoreDuplicates: false })
    .then(() => {})
    .catch(() => {})

  return NextResponse.json({
    results: enriched,
    count:   enriched.length,
    centre:  { lat, lng, radius: usedRadius },
    radius_miles: Math.round(usedRadius / 1609.34),
  })
}
