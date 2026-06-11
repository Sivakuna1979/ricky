// @ts-nocheck
/**
 * Lazy-load full Place Details (phone, website, hours) for a single place_id.
 * GET /api/places/details?place_id=ChIJ...
 * GOOGLE_PLACES_API_KEY never exposed to client.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 503 })

  const placeId = req.nextUrl.searchParams.get('place_id')
  if (!placeId) return NextResponse.json({ error: 'place_id required' }, { status: 400 })

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
    url.searchParams.set('place_id', placeId)
    url.searchParams.set('fields', 'name,formatted_phone_number,website,opening_hours,url')
    url.searchParams.set('key', apiKey)

    const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
    const data = await res.json()

    if (data.status !== 'OK') {
      return NextResponse.json({ error: data.status }, { status: 404 })
    }

    const r = data.result
    return NextResponse.json({
      phone:         r.formatted_phone_number ?? null,
      website:       r.website ?? null,
      google_url:    r.url ?? null,
      open_now:      r.opening_hours?.open_now ?? null,
      weekday_text:  r.opening_hours?.weekday_text ?? null,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch details' }, { status: 500 })
  }
}
