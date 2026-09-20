// @ts-nocheck
// I49–I51 — retention analytics & cohort foundation. Every metric is
// defined precisely here (and only here) so the dashboard, exports and
// AI tool all use the exact same definition:
//   NEW customer (period) = their first-ever order falls in the period.
//   RETURNING customer (period) = they ordered in the period AND had
//     ordered before the period started.
//   Repeat purchase rate = customers with 2+ orders ÷ all customers
//     (all-time, not period-scoped).
//   "Ordered again within X days" = the gap between a customer's first
//     and second order, for customers whose first order falls in a base
//     window old enough that a full X-day follow-up window has elapsed.
import { REVENUE_EXCLUDED_STATUSES } from '@/lib/finance/revenue'
import { computeIdentityKey } from './identity'
import { computeSegmentMembership } from './segments'

async function fetchOrderDatesByIdentity(admin: any, vanIds: string[]) {
  if (!vanIds.length) return new Map<string, string[]>()
  const { data } = await admin.from('orders').select('guest_phone, guest_email, status, created_at').in('van_id', vanIds).order('created_at', { ascending: true }).limit(20000)
  const byIdentity = new Map<string, string[]>()
  for (const o of data ?? []) {
    if (REVENUE_EXCLUDED_STATUSES.includes(o.status)) continue
    const key = computeIdentityKey(o.guest_phone, o.guest_email)
    if (!key) continue
    if (!byIdentity.has(key)) byIdentity.set(key, [])
    byIdentity.get(key)!.push(o.created_at)
  }
  return byIdentity
}

export async function getRetentionSummary(admin: any, businessId: string, vanIds: string[], periodStart: string, periodEnd: string) {
  const byIdentity = await fetchOrderDatesByIdentity(admin, vanIds)
  const periodStartMs = new Date(periodStart).getTime()
  const periodEndMs = new Date(periodEnd).getTime()

  let newCustomers = 0, returningCustomers = 0, totalWithRepeat = 0, lapsedCount = 0
  let totalOrders = 0

  for (const dates of byIdentity.values()) {
    totalOrders += dates.length
    const firstMs = new Date(dates[0]).getTime()
    const hasOrderInPeriod = dates.some(d => { const t = new Date(d).getTime(); return t >= periodStartMs && t <= periodEndMs })
    if (hasOrderInPeriod && firstMs >= periodStartMs) newCustomers++
    if (hasOrderInPeriod && firstMs < periodStartMs) returningCustomers++
    if (dates.length >= 2) totalWithRepeat++
    if (computeSegmentMembership({ order_count: dates.length, recorded_spend: 0, last_order_date: dates[dates.length - 1] }, 'lapsed')) lapsedCount++
  }

  const totalCustomers = byIdentity.size
  return {
    period: { start: periodStart, end: periodEnd },
    new_customers: newCustomers,
    returning_customers: returningCustomers,
    total_customers: totalCustomers,
    repeat_purchase_rate_pct: totalCustomers ? Math.round((totalWithRepeat / totalCustomers) * 1000) / 10 : 0,
    lapsed_customers: lapsedCount,
    average_orders_per_customer: totalCustomers ? Math.round((totalOrders / totalCustomers) * 100) / 100 : 0,
  }
}

// I49 — "customers ordering again within X days": only counts customers
// whose first order was at least X days ago, so a customer who simply
// hasn't had TIME to reorder yet is never miscounted as churned.
export async function getReorderWithinDays(admin: any, businessId: string, vanIds: string[], withinDays: number) {
  const byIdentity = await fetchOrderDatesByIdentity(admin, vanIds)
  const now = Date.now()
  let eligible = 0, reordered = 0
  for (const dates of byIdentity.values()) {
    const firstMs = new Date(dates[0]).getTime()
    if ((now - firstMs) / 86400000 < withinDays) continue // not enough time has passed to judge yet
    eligible++
    if (dates.length >= 2) {
      const secondMs = new Date(dates[1]).getTime()
      if ((secondMs - firstMs) / 86400000 <= withinDays) reordered++
    }
  }
  return { within_days: withinDays, eligible_customers: eligible, reordered_within_window: reordered, pct: eligible ? Math.round((reordered / eligible) * 1000) / 10 : 0 }
}

// I50 — cohort by first-order month: for each of the last N months,
// customers whose first order fell in that month, and what % ordered
// again within 30 days.
export async function getCohorts(admin: any, businessId: string, vanIds: string[], monthsBack = 6) {
  const byIdentity = await fetchOrderDatesByIdentity(admin, vanIds)
  const cohorts: Record<string, { customers: number; reordered_within_30d: number }> = {}
  for (const dates of byIdentity.values()) {
    const monthKey = dates[0].slice(0, 7)
    cohorts[monthKey] ??= { customers: 0, reordered_within_30d: 0 }
    cohorts[monthKey].customers++
    if (dates.length >= 2) {
      const gapDays = (new Date(dates[1]).getTime() - new Date(dates[0]).getTime()) / 86400000
      if (gapDays <= 30) cohorts[monthKey].reordered_within_30d++
    }
  }
  const now = new Date()
  const months = Array.from({ length: monthsBack }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1 - i), 1)
    return d.toISOString().slice(0, 7)
  })
  return months.map(month => {
    const c = cohorts[month]
    return { month, customers: c?.customers ?? 0, reordered_within_30d_pct: c?.customers ? Math.round((c.reordered_within_30d / c.customers) * 1000) / 10 : null }
  })
}
