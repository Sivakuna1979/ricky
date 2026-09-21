// @ts-nocheck
// GET /api/command-centre/comparisons?period=week|month — K9-K12. Compares
// the KPI snapshot for the current calendar week/month against the prior
// one, using the exact same getKpiSnapshot() the overview route uses.
import { NextRequest, NextResponse } from 'next/server'
import { resolveCommandCentreContext } from '@/lib/commandCentre/context'
import { getKpiSnapshot } from '@/lib/commandCentre/kpi'
import { compareValues, priorWeekRange, priorMonthRange, isoStart } from '@/lib/commandCentre/comparison'
import { nowInTimezone } from '@/lib/automations/timezone'
import { resolveDateRange } from '@/lib/ai/dateRange'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') === 'month' ? 'month' : 'week'
  const vanId = searchParams.get('van_id')

  const result = await resolveCommandCentreContext('view_business_intelligence', vanId)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { admin, business, effectiveVanIds } = result
  const timezone = business?.timezone ?? 'Europe/London'

  const currentRange = resolveDateRange(period === 'month' ? 'this_month' : 'this_week', timezone)
  const priorRange = period === 'month' ? priorMonthRange(timezone) : priorWeekRange(timezone)

  const [current, prior] = await Promise.all([
    getKpiSnapshot(admin, business.id, effectiveVanIds, { startIso: currentRange.start, endIso: currentRange.end, startDate: currentRange.start.slice(0, 10), endDate: currentRange.end.slice(0, 10) }),
    getKpiSnapshot(admin, business.id, effectiveVanIds, { startIso: prior.start, endIso: prior.end, startDate: prior.start.slice(0, 10), endDate: prior.end.slice(0, 10) }),
  ])

  const metrics = ['revenue', 'orders', 'average_order_value', 'known_gross_contribution', 'recorded_expenses', 'wastage_cost', 'repeat_purchase_rate_pct']
  const comparisons = Object.fromEntries(metrics.map((m) => [m, compareValues(current[m], prior[m])]))

  return NextResponse.json({
    period, current_period: { start: currentRange.start.slice(0, 10), end: currentRange.end.slice(0, 10), label: currentRange.label },
    prior_period: { start: prior.start.slice(0, 10), end: prior.end.slice(0, 10), label: prior.label },
    current, prior, comparisons,
  })
}
