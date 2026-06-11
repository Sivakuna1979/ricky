// @ts-nocheck
/**
 * Secure server-side Google Places search.
 * GOOGLE_PLACES_API_KEY is never sent to the client.
 * GET /api/places/nearby?lat=51.35&lng=-0.30&radius=16000
 */
import { NextRequest, NextResponse } from 'next/server'

const KEYWORDS = [
  'food truck',
  'mobile catering',
  'fish and chips',
  'burger van',
  'pizza van',
  'coffee van',
  'ice cream van',
  'street food',
  'kebab van',
  'catering van',
  'mobile food van',
  'burger truck',
]

function inferType(name: string, types: string[]): string {
  const n = (name ?? '').toLowerCase()
  if (n.includes('fish') || n.includes('chip'))         return 'fish_and_chips'
  if (n.includes('burger') || n.includes('grill'))      return 'burger'
  if (n.includes('pizza'))                              return 'pizza'
  if (n.includes('coffee') || n.includes('café') || n.includes('cafe')) return 'coffee'
  if (n.includes('ice cream') || n.includes('gelato'))  return 'ice_cream'
  if (n.includes('kebab') || n.includes('doner'))       return 'kebab'
  if (n.includes('taco') || n.includes('burrito'))      return 'street_food'
  if (types?.includes('bakery'))                        return 'bakery'
  return 'fast_food'
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
  const radius = parseInt(searchParams.get('radius') ?? '16000') // 10 miles default

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng required', results: [] }, { status: 400 })
  }

  const seen = new Map<string, any>()

  // Fan out all keywords in parallel
  await Promise.allSettled(
    KEYWORDS.map(async (keyword) => {
      try {
        const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
        url.searchParams.set('query', keyword)
        url.searchParams.set('location', `${lat},${lng}`)
        url.searchParams.set('radius', String(radius))
        url.searchParams.set('key', apiKey)

        const res = await fetch(url.toString(), { next: { revalidate: 300 } })
        const data = await res.json()

        if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
          for (const place of data.results ?? []) {
            if (!seen.has(place.place_id)) seen.set(place.place_id, place)
          }
        }
      } catch {}
    })
  )

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
    }
  })

  return NextResponse.json({ results, count: results.length, centre: { lat, lng, radius } })
}
