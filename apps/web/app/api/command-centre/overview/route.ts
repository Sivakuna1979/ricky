// @ts-nocheck
// GET /api/command-centre/overview — K2/K3/K5/K8. The Command Centre's
// main composer: today's KPI snapshot (vs a comparable day), live
// operations per van, and the top attention-first exception/opportunity
// list. Every figure is composed live from its owning phase's own
// authoritative functions (see lib/commandCentre/*) — nothing here is a
// second cached copy of transactional data (K88).
import { NextRequest, NextResponse } from 'next/server'
import { resolveCommandCentreContext } from '@/lib/commandCentre/context'
import { getKpiSnapshot } from '@/lib/commandCentre/kpi'
import { getAllVanSummaries } from '@/lib/commandCentre/liveOps'
import { computeAllExceptions } from '@/lib/commandCentre/exceptions'
import { computeAllOpportunities } from '@/lib/commandCentre/opportunities'
import { reconcileAttentionItems } from '@/lib/commandCentre/attention'
import { sortByPriority } from '@/lib/commandCentre/priority'
import { compareTodayToComparableDays, priorWeekRange, compareValues, isoStart } from '@/lib/commandCentre/comparison'
import { nowInTimezone } from '@/lib/automations/timezone'

// K63/K65 — a business younger than this never gets "vs comparable day"
// trend comparisons treated as meaningful; it gets a setup/readiness
// framing instead of a fabricated baseline.
const COLD_START_DAYS = 14

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const vanId = searchParams.get('van_id')

  const result = await resolveCommandCentreContext('view_command_centre', vanId)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { admin, business, allVans, effectiveVanIds, restricted } = result

  const timezone = business?.timezone ?? 'Europe/London'
  const { date: today } = nowInTimezone(timezone)
  const businessAgeDays = business?.created_at ? Math.floor((Date.now() - new Date(business.created_at).getTime()) / 86400000) : 999
  const coldStart = businessAgeDays < COLD_START_DAYS

  const scopedVans = allVans.filter((v: any) => effectiveVanIds.includes(v.id))

  const [kpiToday, revenueComparison, vanSummaries, rawExceptions, rawOpportunities] = await Promise.all([
    getKpiSnapshot(admin, business.id, effectiveVanIds, { startIso: isoStart(today), endIso: new Date().toISOString(), startDate: today, endDate: today }),
    coldStart ? null : compareTodayToComparableDays(admin, business.id, effectiveVanIds, timezone, async (start, end) => {
      const { data } = await admin.from('orders').select('total, status').in('van_id', effectiveVanIds).gte('created_at', start).lt('created_at', end)
      return (data ?? []).filter((o: any) => o.status !== 'cancelled').reduce((s: number, o: any) => s + (o.total ?? 0), 0)
    }),
    getAllVanSummaries(admin, scopedVans),
    computeAllExceptions(admin, business.id, effectiveVanIds, isoStart(today)),
    coldStart ? [] : computeAllOpportunities(
      admin, business.id, effectiveVanIds,
      { start: today, end: today },
      (() => { const r = priorWeekRange(timezone); return { start: r.start.slice(0, 10), end: r.end.slice(0, 10) } })()
    ),
  ])

  // K3 — deep-link every exception through the reconciled OPEN/ACKNOWLEDGED/
  // RESOLVED/DISMISSED state (K55-K58); dismissed items are filtered out here.
  const exceptions = sortByPriority(
    await reconcileAttentionItems(admin, business.id, rawExceptions.filter((e: any) => restricted ? effectiveVanIds.includes(e.vanId) || !e.vanId : true).map((e: any) => ({ dedupeKey: e.dedupeKey, category: e.category, priority: e.priority, vanId: e.vanId })))
  ).map((state: any) => ({ ...rawExceptions.find((e: any) => e.dedupeKey === state.dedupeKey), ...state }))

  return NextResponse.json({
    business: { id: business.id, name: business.name, timezone },
    date: today,
    cold_start: coldStart,
    business_age_days: businessAgeDays,
    kpi_today: kpiToday,
    revenue_vs_comparable_day: revenueComparison,
    vans: vanSummaries,
    exceptions,
    opportunities: rawOpportunities,
    restricted_to_vans: restricted ? effectiveVanIds : null,
  })
}
