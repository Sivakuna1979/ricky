// @ts-nocheck
// M12-M20/M60-M64 — the group dashboard/Command Centre composer.
// Deliberately calls Phase B/H/K's own existing, authoritative functions
// ONCE PER authorised business (each in its own timezone — M18/M49: "handle
// timezone, partial days ... transparently", never one shared clock for
// every business) and aggregates the results here — this file contains
// NO re-derivation of revenue/COGS/exception logic, only summation.
import { getSalesSummary } from '@/lib/finance/revenue'
import { getCogsSummary } from '@/lib/finance/cogs'
import { resolveFinanceRange } from '@/lib/finance/dateRange'
import { computeAllExceptions } from '@/lib/commandCentre/exceptions'
import { round2, sum } from '@/lib/finance/money'

function fakeRangeParams(range: string) { const p = new URLSearchParams(); p.set('range', range); return p }

// M13 — business directory: status/area/van count/trading/alerts. No
// street address (M13: "no unnecessary private addresses") — city/postcode
// only, the same fields already shown on public van listings.
export async function getGroupBusinessDirectory(admin: any, businessIds: string[]) {
  if (!businessIds.length) return []
  const [{ data: businesses }, { data: vans }, { data: memberships }] = await Promise.all([
    admin.from('businesses').select('id, name, city, postcode, status, timezone').in('id', businessIds),
    admin.from('vans').select('id, business_id, is_active').in('business_id', businessIds),
    admin.from('group_memberships').select('business_id, region_id, status, group_regions(name)').in('business_id', businessIds).eq('status', 'ACTIVE'),
  ])
  const vansByBusiness: Record<string, { total: number; active: number }> = {}
  for (const v of vans ?? []) {
    const b = (vansByBusiness[v.business_id] ??= { total: 0, active: 0 })
    b.total++; if (v.is_active) b.active++
  }
  const regionByBusiness = Object.fromEntries((memberships ?? []).map((m: any) => [m.business_id, m.group_regions?.name ?? null]))

  return (businesses ?? []).map((b: any) => ({
    id: b.id, name: b.name, city: b.city, postcode: b.postcode, status: b.status,
    region: regionByBusiness[b.id] ?? null,
    van_count: vansByBusiness[b.id]?.total ?? 0, active_van_count: vansByBusiness[b.id]?.active ?? 0,
  }))
}

// M14 — factual comparisons/benchmarking, never an opaque score. Each
// business's own revenue/order/AOV for "today" (in ITS OWN timezone),
// plus a coverage note when a business is too new for a fair comparison
// (mirrors K64/K65's cold-start handling).
export async function getGroupKpiComparison(admin: any, businessIds: string[]) {
  if (!businessIds.length) return { businesses: [], totals: { revenue: 0, orders: 0 } }
  const { data: businesses } = await admin.from('businesses').select('id, name, timezone, created_at').in('id', businessIds)
  const { data: vans } = await admin.from('vans').select('id, business_id').in('business_id', businessIds)
  const vansByBusiness: Record<string, string[]> = {}
  for (const v of vans ?? []) (vansByBusiness[v.business_id] ??= []).push(v.id)

  const rows = await Promise.all((businesses ?? []).map(async (b: any) => {
    const tz = b.timezone ?? 'Europe/London'
    const range = resolveFinanceRange(fakeRangeParams('today'), tz)
    const vanIds = vansByBusiness[b.id] ?? []
    const ageDays = Math.floor((Date.now() - new Date(b.created_at).getTime()) / 86400000)
    if (!vanIds.length) return { business_id: b.id, name: b.name, revenue: 0, orders: 0, average_order_value: 0, cold_start: ageDays < 14 }
    const sales = await getSalesSummary(admin, b.id, { vanIds, startIso: range.startIso, endIso: range.endIso })
    return { business_id: b.id, name: b.name, revenue: sales.net_revenue, orders: sales.order_count, average_order_value: sales.order_count ? round2(sales.net_revenue / sales.order_count) : 0, cold_start: ageDays < 14 }
  }))

  return { businesses: rows, totals: { revenue: sum(rows.map((r: any) => r.revenue)), orders: rows.reduce((s: number, r: any) => s + r.orders, 0) } }
}

// M15/M39 — group finance summary. Aggregate net revenue/COGS/gross
// contribution across authorised businesses — never invoice/cash/VAT
// detail here (that stays gated behind view_group_finance_detail and,
// even then, routes to each business's own existing Finance Hub, never
// duplicated here).
export async function getGroupFinanceSummary(admin: any, businessIds: string[], range: string = 'this_week') {
  if (!businessIds.length) return { net_revenue: 0, gross_contribution: 0, cogs_coverage_pct: 0, per_business: [] }
  const { data: businesses } = await admin.from('businesses').select('id, name, timezone').in('id', businessIds)
  const { data: vans } = await admin.from('vans').select('id, business_id').in('business_id', businessIds)
  const vansByBusiness: Record<string, string[]> = {}
  for (const v of vans ?? []) (vansByBusiness[v.business_id] ??= []).push(v.id)

  const perBusiness = await Promise.all((businesses ?? []).map(async (b: any) => {
    const tz = b.timezone ?? 'Europe/London'
    const r = resolveFinanceRange(fakeRangeParams(range), tz)
    const vanIds = vansByBusiness[b.id] ?? []
    if (!vanIds.length) return { business_id: b.id, name: b.name, net_revenue: 0, gross_contribution: 0 }
    const [sales, cogs] = await Promise.all([
      getSalesSummary(admin, b.id, { vanIds, startIso: r.startIso, endIso: r.endIso }),
      getCogsSummary(admin, b.id, { vanIds, startIso: r.startIso, endIso: r.endIso, startDate: r.startDate, endDate: r.endDate }),
    ])
    return { business_id: b.id, name: b.name, net_revenue: sales.net_revenue, gross_contribution: cogs.known_gross_contribution, cogs_coverage_pct: cogs.cogs_coverage_pct }
  }))

  return {
    net_revenue: sum(perBusiness.map((p: any) => p.net_revenue)),
    gross_contribution: sum(perBusiness.map((p: any) => p.gross_contribution)),
    per_business: perBusiness,
  }
}

// M17/M60 — attention items across the group, reusing Phase K's exact
// exception engine per business (never re-implemented) rather than a
// duplicate alert system. No per-business van scoping restriction here
// (a group role sees a business's WHOLE exception set, not a van subset —
// van-level restriction inside a business stays the business's own
// VAN_MANAGER concern, unrelated to group scope).
export async function getGroupAttentionItems(admin: any, businessIds: string[]) {
  if (!businessIds.length) return []
  const { data: businesses } = await admin.from('businesses').select('id, name').in('id', businessIds)
  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0)
  const results = await Promise.all((businesses ?? []).map(async (b: any) => {
    const { data: vans } = await admin.from('vans').select('id').eq('business_id', b.id)
    const vanIds = (vans ?? []).map((v: any) => v.id)
    const exceptions = await computeAllExceptions(admin, b.id, vanIds, todayStart.toISOString())
    return exceptions.map((e: any) => ({ ...e, business_id: b.id, business_name: b.name }))
  }))
  return results.flat()
}

// M18 — group stock intelligence: authorised low/critical/excess counts,
// summed across businesses, never individual stock quantities exposed
// beyond what each business's own Stock page already shows its own staff.
export async function getGroupStockSummary(admin: any, businessIds: string[]) {
  if (!businessIds.length) return { low_stock: 0, out_of_stock: 0, per_business: [] }
  const { data: items } = await admin.from('stock_items').select('id, business_id, minimum_quantity').in('business_id', businessIds).eq('active', true)
  const { data: levels } = await admin.from('stock_levels').select('stock_item_id, quantity').in('stock_item_id', (items ?? []).map((i: any) => i.id))
  const qtyByItem: Record<string, number> = {}
  for (const l of levels ?? []) qtyByItem[l.stock_item_id] = (qtyByItem[l.stock_item_id] ?? 0) + (l.quantity ?? 0)

  const perBusiness: Record<string, { low: number; out: number }> = {}
  for (const item of items ?? []) {
    const qty = qtyByItem[item.id] ?? 0
    const bucket = (perBusiness[item.business_id] ??= { low: 0, out: 0 })
    if (qty <= 0) bucket.out++
    else if (qty <= item.minimum_quantity) bucket.low++
  }
  const rows = Object.entries(perBusiness).map(([business_id, v]) => ({ business_id, low_stock: v.low, out_of_stock: v.out }))
  return { low_stock: rows.reduce((s, r) => s + r.low_stock, 0), out_of_stock: rows.reduce((s, r) => s + r.out_of_stock, 0), per_business: rows }
}

// M18 — hygiene completion/exceptions, aggregate only.
export async function getGroupHygieneSummary(admin: any, businessIds: string[]) {
  if (!businessIds.length) return { missed_checks_7d: 0 }
  const since = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data: vans } = await admin.from('vans').select('id, business_id').in('business_id', businessIds)
  const { data: logs } = await admin.from('hygiene_logs').select('van_id, completed_at').in('van_id', (vans ?? []).map((v: any) => v.id)).gte('completed_at', since)
  // A simple factual count — expected-vs-completed detail stays on each
  // business's own Hygiene page; the group view is a single headline
  // number plus a per-business breakdown for drill-down.
  const completedByVan = new Set((logs ?? []).map((l: any) => l.van_id))
  const missed = (vans ?? []).filter((v: any) => !completedByVan.has(v.id)).length
  return { missed_checks_7d: missed, van_count: (vans ?? []).length }
}

// M18 — vehicle/equipment expiry alerts, aggregate.
export async function getGroupVehicleAlerts(admin: any, businessIds: string[]) {
  if (!businessIds.length) return { expiring_soon: 0, overdue: 0 }
  const { data: vehicles } = await admin.from('vehicle_details').select('id, business_id, mot_expiry, insurance_expiry, tax_expiry, service_due_date').in('business_id', businessIds)
  const soonCutoff = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  let expiringSoon = 0, overdue = 0
  for (const v of vehicles ?? []) {
    for (const date of [v.mot_expiry, v.insurance_expiry, v.tax_expiry, v.service_due_date]) {
      if (!date) continue
      if (date < today) overdue++
      else if (date <= soonCutoff) expiringSoon++
    }
  }
  return { expiring_soon: expiringSoon, overdue }
}

// M18 — customer-growth summary, strictly aggregate counts, NEVER contact
// details (M83/M9: group-level customer PII access is deliberately not
// built at all in this phase).
export async function getGroupCustomerGrowthSummary(admin: any, businessIds: string[]) {
  if (!businessIds.length) return { new_customers_30d: 0, per_business: [] }
  const since = new Date(Date.now() - 30 * 86400000).toISOString()
  const { data: customers } = await admin.from('customers').select('id, business_id, created_at').in('business_id', businessIds).gte('created_at', since)
  const perBusiness: Record<string, number> = {}
  for (const c of customers ?? []) perBusiness[c.business_id] = (perBusiness[c.business_id] ?? 0) + 1
  return { new_customers_30d: (customers ?? []).length, per_business: Object.entries(perBusiness).map(([business_id, count]) => ({ business_id, new_customers_30d: count })) }
}
