// @ts-nocheck
// H32–H37 — VAT settings + recorded summary for a period. GET requires
// view_vat, PATCH (changing registration/rate) requires edit_vat — a
// step up, since this affects how every later calculation reads.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { allowedVanIds } from '@/lib/ai/context'
import { resolveFinanceRange } from '@/lib/finance/dateRange'
import { getVatSummary } from '@/lib/finance/vat'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_vat')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: business } = await admin.from('businesses').select('timezone').eq('id', ctx.businessId).maybeSingle()
  const range = resolveFinanceRange(new URL(req.url).searchParams, business?.timezone ?? 'Europe/London')
  const vanIds = await allowedVanIds(admin, ctx)

  const summary = await getVatSummary(admin, ctx.businessId, { vanIds, ...range })
  return NextResponse.json({ period: range, ...summary })
}

// Body: { is_registered, vat_number?, effective_from?, default_rate? }
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'edit_vat')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const admin = await createAdminClient()
  const { data: existing } = await admin.from('vat_settings').select('*').eq('business_id', ctx.businessId).maybeSingle()

  const updates: any = { business_id: ctx.businessId, updated_by: ctx.userId, updated_at: new Date().toISOString() }
  if (body.is_registered !== undefined) updates.is_registered = !!body.is_registered
  if (body.vat_number !== undefined) updates.vat_number = body.vat_number || null
  if (body.effective_from !== undefined) updates.effective_from = body.effective_from || null
  if (body.default_rate !== undefined) updates.default_rate = Number(body.default_rate)

  const { data: saved, error } = await admin.from('vat_settings').upsert(updates, { onConflict: 'business_id' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent(admin, { actorId: ctx.userId, action: 'finance.vat_settings_changed', entityType: 'vat_settings', entityId: ctx.businessId, oldValues: existing, newValues: saved })
  return NextResponse.json(saved)
}
