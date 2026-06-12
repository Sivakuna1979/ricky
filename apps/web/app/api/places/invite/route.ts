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
    .select('id, name, address, phone, website, business_type, source, google_place_id, rating, invitation_sent_at, notes, status')
    .not('invitation_sent_at', 'is', null)
    .order('invitation_sent_at', { ascending: false })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invitations: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { place_id, name, method = 'manual' } = body
  if (!place_id) return NextResponse.json({ error: 'place_id required' }, { status: 400 })

  const db = getAdmin()
  const now = new Date().toISOString()

  // Upsert on google_place_id — create stub if not yet in DB
  const { error } = await db
    .from('discovered_businesses')
    .upsert({
      name:             name ?? 'Unknown',
      google_place_id:  place_id,
      source:           'google_places',
      status:           'invited',
      invitation_sent_at: now,
      notes:            `Invited via ${method} on ${now}`,
    }, { onConflict: 'google_place_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
