// @ts-nocheck
/**
 * Business claim + registration.
 *
 * GET  /api/places/claim?place_id=...  → discovered business details for the claim page
 * POST /api/places/claim               → full registration: creates auth user,
 *                                          profile, business, links them, marks claimed.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'
const GKEY = process.env.GOOGLE_PLACES_API_KEY

function getAdmin() {
  return createServerClient(URL, SVC, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false },
  })
}

// ── GET: business details for the claim page ───────────────────────────────
export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get('place_id')
  if (!placeId) return NextResponse.json({ error: 'place_id required' }, { status: 400 })

  const db = getAdmin()

  // Look up the discovered business row (may have been created at invite time)
  const { data: row } = await db
    .from('discovered_businesses')
    .select('*')
    .eq('google_place_id', placeId)
    .maybeSingle()

  // Mark as opened (first time the claim link is visited)
  if (row && !row.opened_at) {
    await db.from('discovered_businesses').update({ opened_at: new Date().toISOString() }).eq('id', row.id)
    await db.from('business_invitations').update({ status: 'opened', opened_at: new Date().toISOString() })
      .eq('google_place_id', placeId).neq('status', 'claimed')
  }

  let details: any = {
    name: row?.name ?? null,
    address: row?.address ?? null,
    phone: row?.phone ?? null,
    website: row?.website ?? null,
    rating: row?.rating ?? null,
    category: row?.category ?? row?.business_type ?? null,
    lat: row?.lat ?? null,
    lng: row?.lng ?? null,
    already_claimed: !!row?.claimed_at,
  }

  // Enrich live from Google Places if we have an API key and missing fields
  if (GKEY && (!details.phone || !details.name)) {
    try {
      const u = new URL('https://maps.googleapis.com/maps/api/place/details/json')
      u.searchParams.set('place_id', placeId)
      u.searchParams.set('fields', 'name,formatted_address,formatted_phone_number,international_phone_number,website,rating,geometry,types')
      u.searchParams.set('key', GKEY)
      const r = await fetch(u.toString(), { next: { revalidate: 3600 } })
      const d = await r.json()
      if (d.status === 'OK') {
        const g = d.result
        details.name    = details.name    ?? g.name
        details.address = details.address ?? g.formatted_address
        details.phone   = details.phone   ?? g.formatted_phone_number
        details.website = details.website ?? g.website
        details.rating  = details.rating  ?? g.rating
        details.lat     = details.lat     ?? g.geometry?.location?.lat
        details.lng     = details.lng     ?? g.geometry?.location?.lng
      }
    } catch {}
  }

  return NextResponse.json(details)
}

// ── POST: register the claimant and convert to a real business ─────────────
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const {
    place_id, name, email, password, phone, address, city, postcode,
    business_type = 'other', website,
  } = body

  if (!place_id || !email || !password || !name) {
    return NextResponse.json({ error: 'Missing required fields (name, email, password).' }, { status: 400 })
  }

  const db = getAdmin()

  // 0. Block double-claims
  const { data: existing } = await db
    .from('discovered_businesses')
    .select('id, claimed_at')
    .eq('google_place_id', place_id)
    .maybeSingle()

  if (existing?.claimed_at) {
    return NextResponse.json({ error: 'This business has already been claimed.' }, { status: 409 })
  }

  // 1. Create the auth user (email pre-confirmed so they can log in immediately)
  const { data: authData, error: authErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, role: 'business_owner' },
  })

  if (authErr || !authData?.user) {
    // If the email already exists, guide them to log in
    const msg = authErr?.message ?? 'Could not create account'
    const status = /already|exists|registered/i.test(msg) ? 409 : 500
    return NextResponse.json({ error: msg }, { status })
  }
  const authUserId = authData.user.id

  // 2. Create the profile row
  const { data: profile, error: profErr } = await db.from('users').insert({
    auth_id: authUserId,
    email,
    full_name: name,
    role: 'business_owner',
  }).select('id').single()

  if (profErr || !profile) {
    return NextResponse.json({ error: 'Failed to create profile: ' + (profErr?.message ?? '') }, { status: 500 })
  }

  // 3. Create the business
  const slug = (body.business_name ?? name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const { data: dupe } = await db.from('businesses').select('id').eq('slug', slug).maybeSingle()
  const finalSlug = dupe ? `${slug}-${Date.now().toString(36)}` : slug

  const { data: business, error: bizErr } = await db.from('businesses').insert({
    owner_id: profile.id,
    name: body.business_name ?? name,
    slug: finalSlug,
    business_type,
    phone: phone ?? null,
    email,
    website: website ?? null,
    postcode: postcode ?? null,
    city: city ?? null,
    address: address ?? null,
    status: 'active',
  }).select('id').single()

  if (bizErr || !business) {
    return NextResponse.json({ error: 'Failed to create business: ' + (bizErr?.message ?? '') }, { status: 500 })
  }

  // 4. Start a 14-day trial subscription if a Starter plan exists
  try {
    const { data: plan } = await db.from('subscription_plans').select('id').eq('name', 'Starter').maybeSingle()
    if (plan) {
      const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 14)
      await db.from('subscriptions').insert({
        business_id: business.id, plan_id: plan.id,
        status: 'trialing', trial_ends_at: trialEnd.toISOString(),
      })
    }
  } catch {}

  // 5. Mark the discovered business as claimed + converted
  const now = new Date().toISOString()
  if (existing) {
    await db.from('discovered_businesses').update({
      status: 'claimed', claimed_at: now, claimed_by: profile.id,
      converted_business_id: business.id, phone: phone ?? undefined, email,
    }).eq('id', existing.id)
  } else {
    await db.from('discovered_businesses').insert({
      name: body.business_name ?? name, google_place_id: place_id,
      source: 'google_places', status: 'claimed', claimed_at: now,
      claimed_by: profile.id, converted_business_id: business.id, phone, email,
    })
  }
  await db.from('business_invitations').update({ status: 'claimed', claimed_at: now })
    .eq('google_place_id', place_id)

  return NextResponse.json({
    ok: true,
    message: 'Business registered! You can now sign in.',
    business_id: business.id,
  })
}
