// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAIL = 'sivakuna@icloud.com'

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Please sign in.' }, { status: 401 }) }
  const { data: userRow } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  const { data: biz } = userRow
    ? await supabase.from('businesses').select('id').eq('owner_id', userRow.id).maybeSingle()
    : { data: null }
  if (!biz && user.email !== SUPER_ADMIN_EMAIL) {
    return { error: NextResponse.json({ error: 'No business found for this account.' }, { status: 403 }) }
  }
  return { supabase, user, businessId: biz?.id }
}

export async function GET() {
  const ctx = await getContext()
  if (ctx.error) return ctx.error
  const admin = await createAdminClient()
  const { data } = await admin
    .from('whatsapp_channels')
    .select('id, van_id, phone_number_id, display_number, is_active, created_at')
    .eq('business_id', ctx.businessId)
    .maybeSingle()
  // access_token intentionally never returned
  return NextResponse.json({ channel: data ?? null })
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await getContext()
    if (ctx.error) return ctx.error
    const { van_id, phone_number_id, access_token, display_number } = await req.json()
    if (!van_id || !phone_number_id) return NextResponse.json({ error: 'van_id and phone_number_id are required' }, { status: 400 })

    // The van must belong to this business.
    const admin = await createAdminClient()
    const { data: van } = await admin.from('vans').select('id, business_id').eq('id', van_id).single()
    if (!van || van.business_id !== ctx.businessId) {
      return NextResponse.json({ error: 'That van does not belong to your business.' }, { status: 403 })
    }

    const { data: existing } = await admin
      .from('whatsapp_channels').select('id, access_token').eq('business_id', ctx.businessId).maybeSingle()

    const row: any = {
      business_id: ctx.businessId,
      van_id,
      phone_number_id: String(phone_number_id).trim(),
      display_number: display_number ?? '',
      is_active: true,
    }
    // Only overwrite the token when a new one is provided.
    if (access_token?.trim()) row.access_token = access_token.trim()
    else if (existing?.access_token) row.access_token = existing.access_token
    else return NextResponse.json({ error: 'access_token is required the first time' }, { status: 400 })

    const { error } = existing
      ? await admin.from('whatsapp_channels').update(row).eq('id', existing.id)
      : await admin.from('whatsapp_channels').insert(row)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to save' }, { status: 500 })
  }
}

export async function DELETE() {
  const ctx = await getContext()
  if (ctx.error) return ctx.error
  const admin = await createAdminClient()
  await admin.from('whatsapp_channels').delete().eq('business_id', ctx.businessId)
  return NextResponse.json({ ok: true })
}
