// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ error: 'Missing q' }, { status: 400 })

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=gb&limit=1&format=json`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'FoodTaxi/1.0 (food-taxi.vercel.app)' },
    })
    const data = await res.json()
    if (!data?.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { lat, lon, display_name } = data[0]
    return NextResponse.json({ lat: parseFloat(lat), lng: parseFloat(lon), display_name })
  } catch {
    return NextResponse.json({ error: 'Geocode failed' }, { status: 500 })
  }
}
