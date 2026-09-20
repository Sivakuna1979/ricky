// @ts-nocheck
// I10 — loyalty configuration. Defaults are safe (enabled=false) until a
// business explicitly turns it on.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { getLoyaltySettings } from '@/lib/crm/loyalty'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_loyalty')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  return NextResponse.json(await getLoyaltySettings(admin, ctx.businessId))
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_crm_settings')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const existing = await getLoyaltySettings(admin, ctx.businessId)
  const body = await req.json()
  const updates: any = { business_id: ctx.businessId, updated_by: ctx.userId, updated_at: new Date().toISOString() }
  for (const field of ['enabled', 'programme_name', 'earning_method', 'points_per_pound', 'min_qualifying_order', 'reward_threshold', 'reward_description', 'reward_value', 'reward_value_type', 'expiry_days', 'eligible_channels', 'eligible_van_ids', 'terms_text']) {
    if (body[field] !== undefined) updates[field] = body[field]
  }
  const { data: saved, error } = await admin.from('loyalty_settings').upsert(updates, { onConflict: 'business_id' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent(admin, { actorId: ctx.userId, action: 'crm.loyalty_settings_changed', entityType: 'loyalty_settings', entityId: ctx.businessId, oldValues: existing, newValues: saved })
  return NextResponse.json(saved)
}
