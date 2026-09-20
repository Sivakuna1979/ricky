// @ts-nocheck
// H19–H21 — card reconciliation. Compares FoodTaxi's own card-recorded
// total against a manually-entered external terminal total — provider
// text is free-form (SumUp/Square/Zettle/Stripe/Other); never claimed to
// be a verified settlement (no provider integration exists).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { assertVanAllowed } from '@/lib/ai/context'
import { round2 } from '@/lib/finance/money'
import { getCardRecordedTotal } from '@/lib/finance/revenue'
import { flagForReview } from '@/lib/finance/review'
import { logAuditEvent } from '@/lib/auditLog'

const VARIANCE_FLAG_THRESHOLD = 5

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_cash_variance')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const admin = await createAdminClient()
  let query = admin.from('card_reconciliations').select('*, vans(name)').eq('business_id', ctx.businessId).order('service_date', { ascending: false }).limit(100)
  if (searchParams.get('van_id')) query = query.eq('van_id', searchParams.get('van_id'))
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Body: { van_id, service_date, external_terminal_total?, provider? }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'perform_cash_count')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const { van_id, service_date, external_terminal_total, provider } = body
  if (!van_id || !service_date) return NextResponse.json({ error: 'van_id and service_date are required' }, { status: 400 })
  try { assertVanAllowed(ctx, van_id) } catch { return NextResponse.json({ error: 'Not authorized for that van' }, { status: 403 }) }

  const admin = await createAdminClient()
  const { data: van } = await admin.from('vans').select('id, business_id').eq('id', van_id).maybeSingle()
  if (!van || van.business_id !== ctx.businessId) return NextResponse.json({ error: 'Van not found' }, { status: 404 })

  const recordedTotal = await getCardRecordedTotal(admin, van_id, service_date)
  const externalTotal = external_terminal_total != null ? round2(Number(external_terminal_total)) : null
  const variance = externalTotal != null ? round2(externalTotal - recordedTotal) : null

  const { data: recon, error } = await admin.from('card_reconciliations').insert({
    business_id: ctx.businessId, van_id, service_date, foodtaxi_card_recorded_total: recordedTotal,
    provider: provider ?? null, external_terminal_total: externalTotal, variance, notes: body.notes ?? null, recorded_by: ctx.userId,
  }).select().single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'A card reconciliation already exists for this van on this date.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (variance !== null && Math.abs(variance) >= VARIANCE_FLAG_THRESHOLD) {
    await flagForReview(admin, ctx.businessId, 'card_variance', 'card_reconciliations', recon.id, { van_id, service_date, variance })
  }
  await logAuditEvent(admin, { actorId: ctx.userId, action: 'finance.card_reconciliation_recorded', entityType: 'card_reconciliations', entityId: recon.id, newValues: recon })
  return NextResponse.json(recon, { status: 201 })
}
