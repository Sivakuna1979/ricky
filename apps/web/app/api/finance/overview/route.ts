// @ts-nocheck
// H4–H6 — the Finance dashboard's Overview tab: one call combining
// sales, expenses, known COGS/gross contribution, vehicle/equipment
// costs and the open review-queue count for a period.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { assertVanAllowed, allowedVanIds } from '@/lib/ai/context'
import { resolveFinanceRange } from '@/lib/finance/dateRange'
import { getSalesSummary } from '@/lib/finance/revenue'
import { getExpenseSummary } from '@/lib/finance/expenses'
import { getCogsSummary } from '@/lib/finance/cogs'
import { getVehicleCosts, getEquipmentCosts } from '@/lib/finance/reports'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_finance_summary')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const vanIdParam = searchParams.get('van_id') ?? undefined
  try { if (vanIdParam) assertVanAllowed(ctx, vanIdParam) } catch { return NextResponse.json({ error: 'Not authorized for that van' }, { status: 403 }) }

  const admin = await createAdminClient()
  const { data: business } = await admin.from('businesses').select('timezone, currency').eq('id', ctx.businessId).maybeSingle()
  const range = resolveFinanceRange(searchParams, business?.timezone ?? 'Europe/London')
  const vanIds = vanIdParam ? [vanIdParam] : await allowedVanIds(admin, ctx)

  const canViewSales = hasPermission(ctx.role, 'view_sales_finance')
  const canViewExpenses = hasPermission(ctx.role, 'view_expenses')

  const [sales, expenses, cogs, vehicle, equipment, reviewCount] = await Promise.all([
    canViewSales ? getSalesSummary(admin, ctx.businessId, { vanIds, startIso: range.startIso, endIso: range.endIso }) : null,
    canViewExpenses ? getExpenseSummary(admin, ctx.businessId, { startDate: range.startDate, endDate: range.endDate, vanId: vanIdParam }) : null,
    canViewSales ? getCogsSummary(admin, ctx.businessId, { vanIds, startIso: range.startIso, endIso: range.endIso, startDate: range.startDate, endDate: range.endDate }) : null,
    getVehicleCosts(admin, ctx.businessId, vanIds, range.startDate, range.endDate),
    getEquipmentCosts(admin, ctx.businessId, vanIds, range.startDate, range.endDate),
    admin.from('finance_review_items').select('id', { count: 'exact', head: true }).eq('business_id', ctx.businessId).eq('status', 'OPEN'),
  ])

  return NextResponse.json({
    period: range, currency: business?.currency ?? 'GBP',
    sales, expenses, cogs,
    vehicle_costs: vehicle.total, equipment_costs: equipment.total,
    open_review_items: reviewCount.count ?? 0,
  })
}
