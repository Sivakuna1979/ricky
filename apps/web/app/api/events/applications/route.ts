// @ts-nocheck
/**
 * GET  /api/events/applications?event_id=xxx  — list all applications for an event (admin)
 * POST /api/events/applications               — van owner submits application
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false },
  })
}

export async function GET(req: NextRequest) {
  const event_id = req.nextUrl.searchParams.get('event_id')
  const db = getAdmin()

  const query = db.from('event_applications').select('*').order('created_at', { ascending: false })
  if (event_id) query.eq('event_id', event_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ applications: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { event_id, van_owner_name, van_owner_email, business_name, status, notes } = body

  if (!event_id || !van_owner_email) {
    return NextResponse.json({ error: 'event_id and van_owner_email required' }, { status: 400 })
  }

  const db = getAdmin()
  const { data, error } = await db
    .from('event_applications')
    .upsert({
      event_id, van_owner_name, van_owner_email,
      business_name: business_name ?? null,
      status: status ?? 'interested',
      notes: notes ?? null,
    }, { onConflict: 'event_id,van_owner_email' })
    .select('id')
    .single()

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ error: 'Run SQL migration — event_applications table missing.' }, { status: 500 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If first interest on this event, update admin_status
  if (status === 'interested') {
    await db
      .from('event_requests')
      .update({ admin_status: 'vans_interested' })
      .eq('id', event_id)
      .eq('admin_status', 'published')
  }

  return NextResponse.json({ ok: true, id: data?.id })
}
