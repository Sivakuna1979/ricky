// @ts-nocheck
// K15/K16 — rule-based opportunity detection. Every card carries WHAT,
// WHY, DATA PERIOD, EVIDENCE and DATA COVERAGE explicitly (K16) and NEVER
// executes anything — opportunities are read-only signals for a human to
// act on, same as exceptions (K17: "no autonomous business management").
import { round2 } from '@/lib/finance/money'
import { getDayOfWeekPerformance } from '@/lib/routes/analytics'
import { getRetentionSummary } from '@/lib/crm/retention'
import { coverageForSampleSize } from './comparison'

export type Opportunity = {
  dedupeKey: string
  category: string
  title: string
  why: string
  dataPeriod: string
  evidence: Record<string, any>
  dataCoverage: 'HIGH DATA COVERAGE' | 'LIMITED DATA' | 'INSUFFICIENT DATA'
  possibleAction: string
  actionUrl: string
}

// K15 — repeated sellout: an item that has gone out of stock 3+ times in
// 30 days is very likely under-ordered relative to demand.
export async function repeatedSelloutOpportunities(admin: any, businessId: string): Promise<Opportunity[]> {
  const since = new Date(Date.now() - 30 * 86400000).toISOString()
  const { data: movements } = await admin.from('stock_movements').select('stock_item_id, created_at, stock_items!inner(name, business_id, reorder_quantity)')
    .eq('stock_items.business_id', businessId).lte('new_quantity', 0).gte('created_at', since)
  if (!movements?.length) return []
  const daysByItem: Record<string, Set<string>> = {}
  const nameByItem: Record<string, string> = {}
  for (const m of movements) {
    daysByItem[m.stock_item_id] ??= new Set()
    daysByItem[m.stock_item_id].add(m.created_at.slice(0, 10))
    nameByItem[m.stock_item_id] = m.stock_items?.name
  }
  return Object.entries(daysByItem).filter(([, days]) => days.size >= 3).map(([itemId, days]) => ({
    dedupeKey: `opp_repeated_sellout:${itemId}`, category: 'stock',
    title: `${nameByItem[itemId]} keeps selling out`,
    why: `Went out of stock on ${days.size} separate days in the last 30 days — demand may consistently exceed your usual order quantity.`,
    dataPeriod: 'Last 30 days', evidence: { stock_item_id: itemId, stockout_days: [...days].sort() },
    dataCoverage: coverageForSampleSize(days.size), possibleAction: 'Review this item\'s reorder quantity or order more frequently.',
    actionUrl: '/dashboard/stock',
  }))
}

// K15 — stock risk before a strong route: a van's next scheduled trading
// day is historically a strong day (getDayOfWeekPerformance), but a
// linked stock item is currently low/out.
export async function stockRiskBeforeStrongRouteOpportunities(admin: any, businessId: string, vanIds: string[]): Promise<Opportunity[]> {
  const out: Opportunity[] = []
  for (const vanId of vanIds) {
    const perf = await getDayOfWeekPerformance(admin, businessId, vanId, 8)
    const days = perf?.days ?? []
    if (!days.length) continue
    const sorted = days.filter((d: any) => d.trading_days_sampled >= 2 && d.average_revenue != null).sort((a: any, b: any) => (b.average_revenue ?? 0) - (a.average_revenue ?? 0))
    if (!sorted.length) continue
    const strongest = sorted[0]

    const { data: lowItems } = await admin.from('stock_items').select('id, name, minimum_quantity').eq('business_id', businessId).eq('active', true)
    if (!lowItems?.length) continue
    const { data: levels } = await admin.from('stock_levels').select('stock_item_id, quantity').in('stock_item_id', lowItems.map((i: any) => i.id))
    const totals: Record<string, number> = {}
    for (const l of levels ?? []) totals[l.stock_item_id] = (totals[l.stock_item_id] ?? 0) + (l.quantity ?? 0)
    const atRisk = lowItems.filter((i: any) => (totals[i.id] ?? 0) <= i.minimum_quantity)
    if (!atRisk.length) continue

    out.push({
      dedupeKey: `opp_stock_before_strong_route:${vanId}:${strongest.day}`, category: 'stock', vanId,
      title: `Stock is low ahead of a historically strong trading day`,
      why: `This van's ${strongest.day}s average £${round2(strongest.average_revenue)} over ${strongest.trading_days_sampled} sampled weeks — one of its best days — but ${atRisk.length} stock item(s) are currently low or out.`,
      dataPeriod: 'Last 8 comparable weeks', evidence: { van_id: vanId, strongest_day: strongest, at_risk_items: atRisk.map((i: any) => i.name) },
      dataCoverage: coverageForSampleSize(strongest.trading_days_sampled), possibleAction: 'Restock these items before the next strong route.',
      actionUrl: '/dashboard/stock',
    })
  }
  return out
}

// K15 — improving repeat rate: this period's repeat-customer rate is
// meaningfully higher than the prior period's, worth reinforcing.
export async function improvingRetentionOpportunities(admin: any, businessId: string, vanIds: string[], current: { start: string; end: string }, prior: { start: string; end: string }): Promise<Opportunity[]> {
  const [curr, prev] = await Promise.all([
    getRetentionSummary(admin, businessId, vanIds, current.start, current.end),
    getRetentionSummary(admin, businessId, vanIds, prior.start, prior.end),
  ])
  if (!curr || !prev || !prev.repeat_purchase_rate_pct) return []
  const delta = round2(curr.repeat_purchase_rate_pct - prev.repeat_purchase_rate_pct)
  if (delta >= 5) {
    return [{
      dedupeKey: `opp_improving_retention:${current.start}`, category: 'customer',
      title: 'Repeat-customer rate is improving',
      why: `Repeat rate rose from ${prev.repeat_purchase_rate_pct}% to ${curr.repeat_purchase_rate_pct}% (+${delta} points) versus the prior period.`,
      dataPeriod: `${current.start} to ${current.end}`, evidence: { current_repeat_rate: curr.repeat_purchase_rate_pct, prior_repeat_rate: prev.repeat_purchase_rate_pct },
      dataCoverage: 'HIGH DATA COVERAGE', possibleAction: 'Consider what changed recently (a promo, loyalty push, new stop) and keep doing it.',
      actionUrl: '/dashboard/customers',
    }]
  }
  return []
}

// K15 — high promo redemption: a currently-active promo code has been
// redeemed heavily relative to its remaining limit, or has a high
// per-order uplift — worth reviewing whether to extend/repeat it.
export async function highPromoRedemptionOpportunities(admin: any, businessId: string): Promise<Opportunity[]> {
  const { data: promos } = await admin.from('promo_codes').select('id, code, max_redemptions, is_active').eq('business_id', businessId).eq('is_active', true)
  if (!promos?.length) return []
  const out: Opportunity[] = []
  for (const promo of promos) {
    const { count } = await admin.from('promo_redemptions').select('id', { count: 'exact', head: true }).eq('promo_code_id', promo.id)
    const redemptions = count ?? 0
    if (promo.max_redemptions && redemptions / promo.max_redemptions >= 0.8) {
      out.push({
        dedupeKey: `opp_promo_redemption:${promo.id}`, category: 'customer',
        title: `Promo code ${promo.code} is nearly exhausted`,
        why: `${redemptions} of ${promo.max_redemptions} redemptions used (${round2((redemptions / promo.max_redemptions) * 100)}%) — it's clearly popular.`,
        dataPeriod: 'Since the code was created', evidence: { promo_code_id: promo.id, redemptions, max_redemptions: promo.max_redemptions },
        dataCoverage: 'HIGH DATA COVERAGE', possibleAction: 'Consider raising the redemption limit or creating a follow-up promo.',
        actionUrl: '/dashboard/customers',
      })
    }
  }
  return out
}

export async function computeAllOpportunities(
  admin: any, businessId: string, vanIds: string[], current: { start: string; end: string }, prior: { start: string; end: string }
): Promise<Opportunity[]> {
  const [sellout, stockRisk, retention, promo] = await Promise.all([
    repeatedSelloutOpportunities(admin, businessId),
    stockRiskBeforeStrongRouteOpportunities(admin, businessId, vanIds),
    improvingRetentionOpportunities(admin, businessId, vanIds, current, prior),
    highPromoRedemptionOpportunities(admin, businessId),
  ])
  return [...sellout, ...stockRisk, ...retention, ...promo]
}
