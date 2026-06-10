// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const KEYWORDS = [
  'fish and chips van',
  'mobile food van',
  'burger van',
  'pizza van',
  'coffee van',
  'ice cream van',
  'street food van',
  'food truck',
  'catering van',
  'mobile catering',
  'kebab van',
  'burger truck',
]

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false },
  })
}

function inferFoodType(name: string, types: string[]): string {
  const n = name.toLowerCase()
  if (n.includes('fish') || n.includes('chip'))    return 'fish_and_chips'
  if (n.includes('burger') || n.includes('grill')) return 'burger'
  if (n.includes('pizza'))                          return 'pizza'
  if (n.includes('coffee') || n.includes('cafe'))  return 'coffee'
  if (n.includes('ice cream') || n.includes('gelato')) return 'ice_cream'
  if (n.includes('kebab') || n.includes('doner'))  return 'street_food'
  if (n.includes('taco') || n.includes('burrito')) return 'street_food'
  if (n.includes('crepe') || n.includes('waffle')) return 'dessert'
  if (types.includes('bakery'))                    return 'bakery'
  if (types.includes('cafe') || types.includes('coffee_shop')) return 'coffee'
  return 'fast_food'
}

async function geocodePostcode(q: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ', UK')}&limit=1&format=json`
    const res = await fetch(url, { headers: { 'User-Agent': 'FoodTaxi/1.0' } })
    const data = await res.json()
    if (!data?.length) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch { return null }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Places API key missing — add GOOGLE_PLACES_API_KEY in Vercel environment variables.' },
      { status: 503 }
    )
  }

  const body = await req.json().catch(() => ({}))
  let { lat, lng, postcode, radius_miles = 10, keywords } = body

  // Radius: miles → meters (Google Places max 50000m)
  const radiusMeters = Math.min(Math.round((radius_miles ?? 10) * 1609.34), 50000)

  // Resolve coordinates
  if ((!lat || !lng) && postcode) {
    const geo = await geocodePostcode(postcode)
    if (!geo) return NextResponse.json({ error: `Could not geocode: ${postcode}` }, { status: 400 })
    lat = geo.lat; lng = geo.lng
  }
  if (!lat || !lng) return NextResponse.json({ error: 'lat/lng or postcode required' }, { status: 400 })

  const searchKeywords: string[] = keywords ?? KEYWORDS
  const seen = new Map<string, any>() // place_id → result

  // Search each keyword via Google Places Text Search
  for (const keyword of searchKeywords) {
    try {
      const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
      url.searchParams.set('query', keyword)
      url.searchParams.set('location', `${lat},${lng}`)
      url.searchParams.set('radius', String(radiusMeters))
      url.searchParams.set('key', apiKey)

      const res = await fetch(url.toString())
      const data = await res.json()

      if (data.status === 'REQUEST_DENIED') {
        return NextResponse.json({ error: `Google API error: ${data.error_message ?? data.status}` }, { status: 503 })
      }

      for (const place of data.results ?? []) {
        if (!seen.has(place.place_id)) {
          seen.set(place.place_id, { place, keyword })
        }
      }

      // Handle pagination (up to 2 pages per keyword)
      let nextToken = data.next_page_token
      let pages = 0
      while (nextToken && pages < 2) {
        await new Promise(r => setTimeout(r, 2000)) // Google requires 2s delay
        const pageUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
        pageUrl.searchParams.set('pagetoken', nextToken)
        pageUrl.searchParams.set('key', apiKey)
        const pageRes = await fetch(pageUrl.toString())
        const pageData = await pageRes.json()
        for (const place of pageData.results ?? []) {
          if (!seen.has(place.place_id)) seen.set(place.place_id, { place, keyword })
        }
        nextToken = pageData.next_page_token
        pages++
      }
    } catch {
      // Continue with next keyword on error
    }
  }

  if (seen.size === 0) {
    return NextResponse.json({ ok: true, saved: 0, results: [], message: 'No results found. Try a different location or check your API key has Places API enabled.' })
  }

  // Build rows for Supabase
  const rows = Array.from(seen.values()).map(({ place, keyword }) => {
    const loc = place.geometry?.location ?? {}
    // Extract postcode from formatted_address
    const postcodeMatch = (place.formatted_address ?? '').match(/[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}/i)
    return {
      name:             place.name,
      address:          place.formatted_address ?? '',
      postcode:         postcodeMatch ? postcodeMatch[0].toUpperCase() : null,
      lat:              loc.lat ?? null,
      lng:              loc.lng ?? null,
      phone:            place.formatted_phone_number ?? null,
      website:          place.website ?? null,
      business_type:    inferFoodType(place.name, place.types ?? []),
      source:           'google_places',
      google_place_id:  place.place_id,
      rating:           place.rating ?? null,
      status:           'discovered',
    }
  })

  // Upsert into discovered_businesses
  const db = getAdmin()
  const { data: saved, error } = await db
    .from('discovered_businesses')
    .upsert(rows, { onConflict: 'google_place_id', ignoreDuplicates: false })
    .select('id, name, lat, lng, business_type, address, rating')

  if (error) {
    // If google_place_id column doesn't exist yet, return the data with a hint
    if (error.message.includes('google_place_id') || error.message.includes('column')) {
      return NextResponse.json({
        error: 'Run the SQL migration first to add google_place_id and rating columns.',
        sql: `alter table discovered_businesses add column if not exists google_place_id text unique;
alter table discovered_businesses add column if not exists rating numeric;
alter table discovered_businesses add column if not exists postcode text;`,
      }, { status: 500 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, saved: saved?.length ?? 0, results: saved ?? [], centre: { lat, lng, radius_miles } })
}

// GET: test endpoint to verify API key is configured
export async function GET() {
  const hasKey = !!process.env.GOOGLE_PLACES_API_KEY
  return NextResponse.json({
    configured: hasKey,
    message: hasKey
      ? 'Google Places API key is set.'
      : 'GOOGLE_PLACES_API_KEY is not set. Add it in Vercel → Settings → Environment Variables.',
  })
}
