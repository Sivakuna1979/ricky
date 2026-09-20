// @ts-nocheck
// H38–H40 — management (P&L-style) report, cash-flow view, monthly view,
// and per-van finance — one dispatcher over ?type=, matching Phase G's
// analytics route convention.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { assertVanAllowed, allowedVanIds } from '@/lib/ai/context'
import { resolveFinanceRange } from '@/lib/finance/dateRange'
import { getManagementReport, getCashFlowView, getVanFinance } from '@/lib/finance/reports'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_finance_summary')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'management'
  const admin = await createAdminClient()
  const { data: business } = await admin.from('businesses').select('timezone').eq('id', ctx.businessId).maybeSingle()
  const timezone = business?.timezone ?? 'Europe/London'
  const range = resolveFinanceRange(searchParams, timezone)

  if (type === 'management') {
    const vanIds = await allowedVanIds(admin, ctx)
    return NextResponse.json(await getManagementReport(admin, ctx.businessId, { vanIds, ...range }))
  }

  if (type === 'cashflow') {
    const vanIds = await allowedVanIds(admin, ctx)
    return NextResponse.json(await getCashFlowView(admin, ctx.businessId, vanIds, range.startDate, range.endDate))
  }

  if (type === 'van') {
    const vanId = searchParams.get('van_id')
    if (!vanId) return NextResponse.json({ error: 'van_id required' }, { status: 400 })
    try { assertVanAllowed(ctx, vanId) } catch { return NextResponse.json({ error: 'Not authorized for that van' }, { status: 403 }) }
    return NextResponse.json(await getVanFinance(admin, ctx.businessId, vanId, range))
  }

  if (type === 'monthly') {
    const monthsBack = Math.min(Number(searchParams.get('months') ?? 6), 24)
    const vanIds = await allowedVanIds(admin, ctx)
    const months = []
    const now = new Date()
    for (let i = monthsBack - 1; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const startDate = monthDate.toISOString().slice(0, 10)
      const endDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString().slice(0, 10)
      const startIso = `${startDate}T00:00:00.000Z`
      const endIso = new Date(new Date(`${endDate}T00:00:00Z`).getTime() + 86400000).toISOString()
      months.push(await getManagementReport(admin, ctx.businessId, { vanIds, startIso, endIso, startDate, endDate }))
    }
    return NextResponse.json({ months })
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}
