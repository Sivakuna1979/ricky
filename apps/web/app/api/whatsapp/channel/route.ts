// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAIL = 'sivakuna@icloud.com'

// GET — business owner sees only their connection STATUS (no credentials,
// no technical ids). Setup itself is done by FoodTaxi staff via /api/admin.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const { data: userRow } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  const { data: biz } = userRow
    ? await supabase.from('businesses').select('id').eq('owner_id', userRow.id).maybeSingle()
    : { data: null }
  if (!biz) return NextResponse.json({ channel: null, requested: false })

  const admin = await createAdminClient()
  const { data: ch } = await admin
    .from('whatsapp_channels')
    .select('display_number, is_active')
    .eq('business_id', biz.id)
    .eq('is_active', true)
    .maybeSingle()
  const { data: reqRow } = await admin
    .from('whatsapp_requests')
    .select('id')
    .eq('business_id', biz.id)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    channel: ch ? { display_number: ch.display_number } : null,
    requested: Boolean(reqRow),
  })
}

// PUT/DELETE — FoodTaxi staff only.
async function requireStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== SUPER_ADMIN_EMAIL) {
    return { error: NextResponse.json({ error: 'Not authorized.' }, { status: 403 }) }
  }
  return {}
}

export async function PUT(req: NextRequest) {
  try {
    const gate = await requireStaff()
    if (gate.error) return gate.error
    const { business_id, van_id, phone_number_id, access_token, display_number, is_active } = await req.json()
    if (!business_id || !van_id || !phone_number_id) {
      return NextResponse.json({ error: 'business_id, van_id and phone_number_id are required' }, { status: 400 })
    }

    const admin = await createAdminClient()
    const { data: existing } = await admin
      .from('whatsapp_channels').select('id, access_token').eq('business_id', business_id).maybeSingle()

    const row: any = {
      business_id,
      van_id,
      phone_number_id: String(phone_number_id).trim(),
      display_number: display_number ?? '',
      is_active: is_active ?? true,
    }
    if (access_token?.trim()) row.access_token = access_token.trim()
    else if (existing?.access_token) row.access_token = existing.access_token
    else return NextResponse.json({ error: 'access_token is required the first time' }, { status: 400 })

    const { error } = existing
      ? await admin.from('whatsapp_channels').update(row).eq('id', existing.id)
      : await admin.from('whatsapp_channels').insert(row)
    if (error) throw new Error(error.message)

    // Mark any pending request as done.
    await admin.from('whatsapp_requests').update({ status: 'done' }).eq('business_id', business_id).eq('status', 'pending')
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to save' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const gate = await requireStaff()
  if (gate.error) return gate.error
  const { business_id } = await req.json().catch(() => ({}))
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 })
  const admin = await createAdminClient()
  await admin.from('whatsapp_channels').delete().eq('business_id', business_id)
  return NextResponse.json({ ok: true })
}
