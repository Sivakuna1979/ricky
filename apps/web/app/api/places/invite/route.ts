// @ts-nocheck
/**
 * POST /api/places/invite
 * Records that a Google business was sent a FoodTaxi invitation.
 * Body: { place_id, name, method }  — method: 'whatsapp'|'sms'|'email'|'copy_link'|'manual'
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

export async function GET(req: NextRequest) {
  // Admin: list all invited businesses
  const db = getAdmin()
  const { data, error } = await db
    .from('discovered_businesses')
    .select('id, name, address, phone, email, website, business_type, source, google_place_id, rating, invitation_sent_at, invitation_method, invitation_token, opened_at, claimed_at, notes, status')
    .not('invitation_sent_at', 'is', null)
    .order('invitation_sent_at', { ascending: false })
    .limit(300)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invitations: data ?? [] })
}

// PATCH — update notes or status (e.g. mark as contacted) from the admin page
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { id, notes, status } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const db = getAdmin()
  const patch: any = {}
  if (notes != null)  patch.notes = notes
  if (status != null) patch.status = status
  const { error } = await db.from('discovered_businesses').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

function makeToken() {
  // 32 hex chars — hard to guess
  let s = ''
  const c = '0123456789abcdef'
  for (let i = 0; i < 32; i++) s += c[Math.floor(Math.random() * 16)]
  return s
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const {
    place_id, name, method = 'manual', phone = null, website = null,
    email = null, address = null, rating = null, business_type = null,
  } = body
  if (!place_id) return NextResponse.json({ error: 'place_id required' }, { status: 400 })

  const db = getAdmin()
  const now = new Date().toISOString()
  const token = makeToken()

  // Upsert discovered_businesses — create stub if not yet in DB
  const record: any = {
    name:             name ?? 'Unknown',
    google_place_id:  place_id,
    source:           'google_places',
    status:           'invited',
    invitation_sent_at: now,
    invitation_method: method,
    invitation_token: token,
    notes:            `Invited via ${method} on ${now}`,
  }
  if (phone)   record.phone = phone
  if (website) record.website = website
  if (email)   record.email = email
  if (address) record.address = address
  if (rating != null) record.rating = rating
  if (business_type) record.business_type = business_type

  const { data: dbRow, error } = await db
    .from('discovered_businesses')
    .upsert(record, { onConflict: 'google_place_id' })
    .select('id, invitation_token')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log to business_invitations audit table (best-effort)
  try {
    await db.from('business_invitations').insert({
      discovered_id:    dbRow?.id ?? null,
      google_place_id:  place_id,
      business_name:    name ?? 'Unknown',
      phone, email, website, address,
      invitation_token: dbRow?.invitation_token ?? token,
      status:           'sent',
      method,
      sent_at:          now,
    })
  } catch {}

  return NextResponse.json({ ok: true, token: dbRow?.invitation_token ?? token })
}
