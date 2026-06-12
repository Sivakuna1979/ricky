// @ts-nocheck
/**
 * Business claim submission.
 * POST /api/places/claim
 * Body: { place_id, name, claimant_name, claimant_email, claimant_phone }
 *
 * Marks the discovered_business row as 'claim_pending' so admins can verify.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'
  return createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false },
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { place_id, name, claimant_name, claimant_email, claimant_phone } = body

  if (!place_id || !claimant_email) {
    return NextResponse.json({ error: 'place_id and claimant_email required' }, { status: 400 })
  }

  const db = getAdmin()

  // Find the discovered_business row by google_place_id
  const { data: existing } = await db
    .from('discovered_businesses')
    .select('id, status')
    .eq('google_place_id', place_id)
    .single()

  if (!existing) {
    // Insert a stub row so the claim can be tracked
    await db.from('discovered_businesses').insert({
      name:            name ?? 'Unknown',
      google_place_id: place_id,
      source:          'google_places',
      status:          'claim_pending',
      notes:           `Claim by ${claimant_name} <${claimant_email}> ${claimant_phone ?? ''}`.trim(),
    })
  } else {
    await db.from('discovered_businesses')
      .update({
        status: 'claim_pending',
        notes:  `Claim by ${claimant_name} <${claimant_email}> ${claimant_phone ?? ''}`.trim(),
      })
      .eq('id', existing.id)
  }

  return NextResponse.json({ ok: true, message: 'Claim submitted — we will contact you within 24 hours.' })
}
