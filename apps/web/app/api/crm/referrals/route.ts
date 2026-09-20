// @ts-nocheck
// I24/I25 — referral settings + conversion history. Referral codes
// themselves are generated per-customer from the customer profile
// (staff hands the code to the customer) — see
// app/api/crm/customers/[id]/referral-code/route.ts. A fully self-service
// customer-facing referral portal was not built in this pass (see docs
// "Not built") given how few orders currently come from an authenticated
// customer session to build one around.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { getReferralSettings } from '@/lib/crm/referrals'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_promotions')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const [settings, { data: conversions }] = await Promise.all([
    getReferralSettings(admin, ctx.businessId),
    admin.from('referral_conversions').select('*, referral_codes(code, crm_customers(display_name))').eq('business_id', ctx.businessId).order('created_at', { ascending: false }).limit(100),
  ])
  return NextResponse.json({ settings, conversions: conversions ?? [] })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_crm_settings')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const existing = await getReferralSettings(admin, ctx.businessId)
  const body = await req.json()
  const updates: any = { business_id: ctx.businessId, updated_by: ctx.userId, updated_at: new Date().toISOString() }
  for (const field of ['enabled', 'referrer_reward_type', 'referrer_reward_value', 'reward_new_customer', 'referred_reward_type', 'referred_reward_value']) {
    if (body[field] !== undefined) updates[field] = body[field]
  }
  const { data: saved, error } = await admin.from('referral_settings').upsert(updates, { onConflict: 'business_id' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent(admin, { actorId: ctx.userId, action: 'crm.referral_settings_changed', entityType: 'referral_settings', entityId: ctx.businessId, oldValues: existing, newValues: saved })
  return NextResponse.json(saved)
}
