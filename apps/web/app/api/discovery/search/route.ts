// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GOOGLE_PLACES_TYPES = [
  'food',
  'restaurant',
  'meal_takeaway',
  'meal_delivery',
]

const FOOD_VAN_KEYWORDS = [
  'food truck', 'mobile food', 'food van', 'fish and chips van',
  'burger van', 'coffee van', 'ice cream van', 'catering van',
  'street food', 'mobile caterer',
]

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check super admin
  const { data: userData } = await supabase.from('users').select('role').eq('auth_id', user.id).single()
  if (userData?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { postcode, town, radius_km = 10, keyword = 'food van' } = await req.json()
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  const query = encodeURIComponent(`${keyword} near ${town || postcode}`)

  // Google Places Text Search
  const googleRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&radius=${radius_km * 1000}&key=${apiKey}`
  )
  const googleData = await googleRes.json()

  const results = []
  for (const place of (googleData.results ?? []).slice(0, 20)) {
    const { place_id, name, formatted_address, geometry, rating, types } = place

    // Check if already imported
    const { data: existing } = await supabase
      .from('imported_businesses')
      .select('id')
      .eq('google_place_id', place_id)
      .single()

    if (existing) { results.push({ ...place, already_imported: true }); continue }

    // Get details
    const detailRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=name,formatted_address,formatted_phone_number,website,rating,geometry&key=${apiKey}`
    )
    const detail = await detailRes.json()
    const d = detail.result ?? {}

    // Try FSA match by postcode
    const postcodeMatch = formatted_address?.match(/[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}/i)
    let fsaRating = null
    if (postcodeMatch) {
      const fsaRes = await fetch(
        `${process.env.FSA_API_BASE_URL}/Establishments?localAuthorityId=&BusinessTypeId=&pc=${postcodeMatch[0]}&pageSize=10`,
        { headers: { 'x-api-version': '2' } }
      )
      const fsaData = await fsaRes.json()
      const fsaMatch = fsaData.establishments?.find(
        (e: { BusinessName: string; RatingValue: string }) =>
          e.BusinessName?.toLowerCase().includes(name.toLowerCase())
      )
      fsaRating = fsaMatch ? parseInt(fsaMatch.RatingValue) : null
    }

    // Infer business type from name/types
    const businessType = inferBusinessType(name, types)

    const { data: imported } = await supabase
      .from('imported_businesses')
      .insert({
        google_place_id: place_id,
        name,
        address: formatted_address,
        phone: d.formatted_phone_number,
        website: d.website,
        latitude: geometry?.location?.lat,
        longitude: geometry?.location?.lng,
        google_rating: rating,
        fsa_hygiene_rating: fsaRating,
        business_type: businessType,
        source: 'google_places',
        raw_data: d,
      })
      .select()
      .single()

    results.push({ ...imported, already_imported: false })
  }

  return NextResponse.json({ count: results.length, results })
}

function inferBusinessType(name: string, types: string[]): string {
  const n = name.toLowerCase()
  if (n.includes('fish') || n.includes('chip')) return 'fish_and_chips'
  if (n.includes('burger') || n.includes('grill')) return 'burger'
  if (n.includes('coffee') || n.includes('cafe') || n.includes('barista')) return 'coffee'
  if (n.includes('ice cream') || n.includes('gelato')) return 'ice_cream'
  if (n.includes('pizza')) return 'pizza'
  if (n.includes('dessert') || n.includes('waffle') || n.includes('crepe')) return 'dessert'
  if (n.includes('street food') || n.includes('thai') || n.includes('chinese') || n.includes('curry')) return 'street_food'
  return 'other'
}
