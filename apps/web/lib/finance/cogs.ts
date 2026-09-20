// @ts-nocheck
// H24–H27 — known product cost and gross contribution. Chosen cost
// method (documented in the Phase H migration and docs): "latest
// confirmed cost" — stock_items.cost_price, the only cost figure that
// exists anywhere in the schema (no per-sale historical cost is
// captured). This means editing a stock item's cost price changes the
// cost basis a past period's report uses the NEXT time it's generated —
// a documented limitation, not a silent rewrite of any stored figure
// (nothing here is ever persisted and later mutated; every call
// recomputes from current recipe + current cost_price).
//
// Coverage (H27): revenue is split into "known cost" (every stock
// component of the item's recipe has a cost_price) and "unknown cost"
// (the item has no recipe at all, or a component's cost_price is NULL).
// Gross contribution is only ever computed over the known-cost portion,
// and is never called "net profit" (H24/H148) — see the label used
// throughout: "gross contribution".
import { round2, sum } from './money'
import { REVENUE_EXCLUDED_STATUSES } from './revenue'

// Cost of one order's items, or null components list when unresolved.
async function costPerMenuItem(admin: any, businessId: string, menuItemIds: string[]) {
  if (!menuItemIds.length) return {}
  const { data: components } = await admin.from('menu_stock_components')
    .select('menu_item_id, quantity_per_item, stock_items(cost_price)')
    .in('menu_item_id', menuItemIds)
  const byMenuItem: Record<string, { cost: number; complete: boolean } | null> = {}
  const grouped: Record<string, any[]> = {}
  for (const c of components ?? []) (grouped[c.menu_item_id] ??= []).push(c)
  for (const menuItemId of menuItemIds) {
    const comps = grouped[menuItemId]
    if (!comps?.length) { byMenuItem[menuItemId] = null; continue } // no recipe at all — unknown cost
    let cost = 0
    let complete = true
    for (const c of comps) {
      const unitCost = c.stock_items?.cost_price
      if (unitCost == null) { complete = false; continue }
      cost += unitCost * (c.quantity_per_item ?? 0)
    }
    byMenuItem[menuItemId] = complete ? { cost: round2(cost), complete: true } : null
  }
  return byMenuItem
}

// H24–H27 — gross contribution for a date range (orders.created_at,
// same window convention as getSalesSummary). Wastage cost (already
// authoritative in wastage_records.cost, per the H1 audit) is reported
// alongside but is NOT subtracted from gross contribution automatically —
// it's shown as its own line so nothing is double-counted or silently
// netted off without the reader seeing both numbers (H27).
export async function getCogsSummary(admin: any, businessId: string, opts: { vanIds: string[]; startIso: string; endIso: string; startDate: string; endDate: string }) {
  if (!opts.vanIds.length) return emptyCogsSummary()

  const { data: orders, error } = await admin.from('orders').select('id, total, status')
    .in('van_id', opts.vanIds).gte('created_at', opts.startIso).lt('created_at', opts.endIso)
  if (error) throw new Error('orders_query_failed')
  const revenueOrders = (orders ?? []).filter((o: any) => !REVENUE_EXCLUDED_STATUSES.includes(o.status))
  if (!revenueOrders.length) return emptyCogsSummary()

  const orderIds = revenueOrders.map((o: any) => o.id)
  const { data: items } = await admin.from('order_items').select('order_id, menu_item_id, quantity, item_total').in('order_id', orderIds.slice(0, 1000))
  const menuItemIds = [...new Set((items ?? []).map((i: any) => i.menu_item_id).filter(Boolean))]
  const costByMenuItem = await costPerMenuItem(admin, businessId, menuItemIds)

  let knownRevenue = 0, unknownRevenue = 0, knownCost = 0
  for (const it of items ?? []) {
    const lineRevenue = it.item_total ?? 0
    const costEntry = it.menu_item_id ? costByMenuItem[it.menu_item_id] : null
    if (costEntry) { knownRevenue += lineRevenue; knownCost += costEntry.cost * (it.quantity ?? 1) }
    else unknownRevenue += lineRevenue
  }

  const { data: wastage } = await admin.from('wastage_records').select('cost').eq('business_id', businessId).gte('created_at', opts.startIso).lt('created_at', opts.endIso)
  const wastageCost = sum((wastage ?? []).map((w: any) => w.cost))

  const totalRevenue = round2(knownRevenue + unknownRevenue)
  const grossContribution = round2(knownRevenue - knownCost)
  return {
    total_revenue: totalRevenue,
    known_cost_revenue: round2(knownRevenue),
    unknown_cost_revenue: round2(unknownRevenue),
    coverage_pct: totalRevenue ? round2((knownRevenue / totalRevenue) * 100) : 0,
    known_cogs: round2(knownCost),
    gross_contribution: grossContribution, // over the KNOWN-cost portion only — never labelled "profit"
    gross_contribution_margin_pct: knownRevenue ? round2((grossContribution / knownRevenue) * 100) : 0,
    wastage_cost: wastageCost,
    method: 'latest_confirmed_cost',
    note: unknownRevenue > 0 ? `£${round2(unknownRevenue).toFixed(2)} of revenue has no complete recipe/cost configured and is excluded from gross contribution.` : null,
  }
}

function emptyCogsSummary() {
  return { total_revenue: 0, known_cost_revenue: 0, unknown_cost_revenue: 0, coverage_pct: 0, known_cogs: 0, gross_contribution: 0, gross_contribution_margin_pct: 0, wastage_cost: 0, method: 'latest_confirmed_cost', note: null }
}
