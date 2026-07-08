// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAIL = 'sivakuna@icloud.com'

// All event communication stays inside FoodTaxi.
// Van owners authenticate a thread with the email they applied with;
// FoodTaxi staff authenticate with their login.

async function isStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === SUPER_ADMIN_EMAIL
}

async function canAccess(admin: any, application_id: string, email: string | null) {
  if (await isStaff()) return true
  if (!email) return false
  const { data: app } = await admin
    .from('event_applications').select('van_owner_email').eq('id', application_id).single()
  return app?.van_owner_email?.toLowerCase() === email.toLowerCase()
}

export async function GET(req: NextRequest) {
  const application_id = req.nextUrl.searchParams.get('application_id')
  const email = req.nextUrl.searchParams.get('email')
  if (!application_id) return NextResponse.json({ error: 'application_id required' }, { status: 400 })

  const admin = await createAdminClient()
  if (!(await canAccess(admin, application_id, email))) {
    return NextResponse.json({ error: 'Not authorized for this conversation.' }, { status: 403 })
  }
  const { data, error } = await admin
    .from('event_messages')
    .select('id, sender, body, created_at')
    .eq('application_id', application_id)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { application_id, email, body } = await req.json().catch(() => ({}))
  if (!application_id || !body?.trim()) return NextResponse.json({ error: 'application_id and body required' }, { status: 400 })

  const admin = await createAdminClient()
  const staff = await isStaff()
  if (!staff && !(await canAccess(admin, application_id, email))) {
    return NextResponse.json({ error: 'Not authorized for this conversation.' }, { status: 403 })
  }
  const { error } = await admin.from('event_messages').insert({
    application_id,
    sender: staff ? 'foodtaxi' : 'van',
    body: String(body).slice(0, 2000),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
