// @ts-nocheck
// H16–H18 — cash reconciliation. POST computes expected cash server-side
// (never trusts a client-supplied expected figure) and stores the
// snapshot alongside the actual count and variance.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { assertVanAllowed } from '@/lib/ai/context'
import { round2 } from '@/lib/finance/money'
import { computeExpectedCash, totalFromDenominations } from '@/lib/finance/cash'
import { flagForReview } from '@/lib/finance/review'
import { logAuditEvent } from '@/lib/auditLog'

const VARIANCE_FLAG_THRESHOLD = 5 // £5 — flags for review, never blocks the count being saved

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_cash_variance')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const vanId = searchParams.get('van_id')
  const admin = await createAdminClient()
  let query = admin.from('cash_reconciliations').select('*, vans(name)').eq('business_id', ctx.businessId).order('service_date', { ascending: false }).limit(100)
  if (vanId) query = query.eq('van_id', vanId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Body: { van_id, service_date, opening_float, actual_cash (or denomination_breakdown), variance_reason? }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'perform_cash_count')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const { van_id, service_date, opening_float, denomination_breakdown, variance_reason } = body
  if (!van_id || !service_date) return NextResponse.json({ error: 'van_id and service_date are required' }, { status: 400 })
  try { assertVanAllowed(ctx, van_id) } catch { return NextResponse.json({ error: 'Not authorized for that van' }, { status: 403 }) }

  const actualCash = denomination_breakdown ? totalFromDenominations(denomination_breakdown) : round2(Number(body.actual_cash))
  if (actualCash == null || Number.isNaN(actualCash)) return NextResponse.json({ error: 'actual_cash or denomination_breakdown is required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: van } = await admin.from('vans').select('id, business_id').eq('id', van_id).maybeSingle()
  if (!van || van.business_id !== ctx.businessId) return NextResponse.json({ error: 'Van not found' }, { status: 404 })

  const { cashSalesRecorded, cashRefundsRecorded, recordedCashExpenses, expectedCash } = await computeExpectedCash(admin, ctx.businessId, van_id, service_date, round2(Number(opening_float ?? 0)))
  const variance = round2(actualCash - expectedCash)

  const { data: recon, error } = await admin.from('cash_reconciliations').insert({
    business_id: ctx.businessId, van_id, service_date, opening_float: round2(Number(opening_float ?? 0)),
    cash_sales_recorded: cashSalesRecorded, cash_refunds_recorded: cashRefundsRecorded, recorded_cash_expenses: recordedCashExpenses,
    expected_cash: expectedCash, actual_cash: actualCash, variance,
    denomination_breakdown: denomination_breakdown ?? null, variance_reason: variance_reason ?? null, recorded_by: ctx.userId,
  }).select().single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'A cash count already exists for this van on this date.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (Math.abs(variance) >= VARIANCE_FLAG_THRESHOLD) {
    await flagForReview(admin, ctx.businessId, 'cash_variance', 'cash_reconciliations', recon.id, { van_id, service_date, variance })
  }
  await logAuditEvent(admin, { actorId: ctx.userId, action: 'finance.cash_reconciliation_recorded', entityType: 'cash_reconciliations', entityId: recon.id, newValues: recon })
  return NextResponse.json(recon, { status: 201 })
}
