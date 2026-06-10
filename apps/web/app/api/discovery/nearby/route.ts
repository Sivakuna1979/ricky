// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'

const DEMO_DISCOVERED = [
  { id: 'demo_disc_1', name: "Shudehill Market Grill",    address: "Shudehill, Manchester",          lat: 53.4851, lng: -2.2378, phone: '', website: '', business_type: 'fast_food',  source: 'overpass', isRegistered: false },
  { id: 'demo_disc_2', name: "Northern Quarter Bakery",   address: "Oldham Street, Manchester",      lat: 53.4833, lng: -2.2337, phone: '', website: '', business_type: 'bakery',     source: 'overpass', isRegistered: false },
  { id: 'demo_disc_3', name: "Piccadilly Coffee House",   address: "Piccadilly Gardens, Manchester", lat: 53.4805, lng: -2.2374, phone: '', website: '', business_type: 'cafe',       source: 'overpass', isRegistered: false },
  { id: 'demo_disc_4', name: "Arndale Food Court",        address: "Market Street, Manchester",      lat: 53.4820, lng: -2.2421, phone: '', website: '', business_type: 'food_court', source: 'overpass', isRegistered: false },
  { id: 'demo_disc_5', name: "Chinatown Deli Express",    address: "Faulkner Street, Manchester",    lat: 53.4776, lng: -2.2329, phone: '', website: '', business_type: 'deli',       source: 'overpass', isRegistered: false },
]

function deriveBusinessType(tags: Record<string, string>): string {
  if (tags.amenity) return tags.amenity
  if (tags.shop)    return tags.shop
  return 'food_business'
}

function deriveAddress(tags: Record<string, string>): string {
  if (tags['addr:full']) return tags['addr:full']
  const parts = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean)
  if (parts.length) return parts.join(' ')
  return ''
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat    = parseFloat(searchParams.get('lat')    ?? '53.4808')
  const lng    = parseFloat(searchParams.get('lng')    ?? '-2.2426')
  const radius = parseInt(searchParams.get('radius')   ?? '3000', 10)

  const query = `[out:json][timeout:15];
(
  node["amenity"~"^(fast_food|cafe|ice_cream|food_court|marketplace)$"](around:${radius},${lat},${lng});
  node["shop"~"^(bakery|deli|confectionery|mobile_food)$"](around:${radius},${lat},${lng});
  node["amenity"="mobile_food_vendor"](around:${radius},${lat},${lng});
);
out body;`

  let discovered: any[] = []

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(18000),
    })

    if (res.ok) {
      const json = await res.json()
      const elements: any[] = json.elements ?? []

      discovered = elements
        .filter(el => el.tags?.name)
        .map(el => ({
          id:            'osm_' + el.id,
          name:          el.tags.name ?? 'Unnamed Food Business',
          address:       deriveAddress(el.tags),
          lat:           el.lat,
          lng:           el.lon,
          phone:         el.tags.phone ?? el.tags['contact:phone'] ?? '',
          website:       el.tags.website ?? el.tags['contact:website'] ?? '',
          business_type: deriveBusinessType(el.tags),
          source:        'overpass',
          isRegistered:  false,
        }))
    }
  } catch {
    // Overpass unavailable — fall through to demo data
  }

  if (discovered.length === 0) {
    discovered = DEMO_DISCOVERED
  }

  return NextResponse.json({ registered: [], discovered })
}
