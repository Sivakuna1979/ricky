// @ts-nocheck
// K27-K31 — supplier cost trends and menu margin review. The ONLY
// confirmed cost-history source used is purchase_order_items.unit_cost on
// RECEIVED/PARTIALLY_RECEIVED purchase orders — real, line-level,
// immutable, business-confirmed records. finance_documents (Phase H's OCR
// extraction) is deliberately never read here — K27's "no unconfirmed OCR
// as authoritative" (see the migration's own audit comment for why).
import { round2 } from '@/lib/finance/money'

// K27 — latest vs previous confirmed price per stock item, with the date
// and percentage change. Only items with at least 2 confirmed purchases
// produce a result; a single purchase has nothing to compare against.
export async function getSupplierPriceChanges(admin: any, businessId: string) {
  const { data: items } = await admin.from('stock_items').select('id, name, supplier_id, supplier_records(name)').eq('business_id', businessId).eq('active', true)
  if (!items?.length) return []

  const { data: poItems } = await admin
    .from('purchase_order_items')
    .select('stock_item_id, unit_cost, purchase_orders!inner(id, business_id, status, created_at, supplier_id)')
    .eq('purchase_orders.business_id', businessId)
    .in('purchase_orders.status', ['RECEIVED', 'PARTIALLY_RECEIVED'])
    .not('unit_cost', 'is', null)

  const byItem: Record<string, { cost: number; date: string }[]> = {}
  for (const row of poItems ?? []) {
    byItem[row.stock_item_id] ??= []
    byItem[row.stock_item_id].push({ cost: Number(row.unit_cost), date: row.purchase_orders.created_at })
  }

  const nameById: Record<string, { name: string; supplier: string | null }> = Object.fromEntries(
    items.map((i: any) => [i.id, { name: i.name, supplier: i.supplier_records?.name ?? null }])
  )

  const out: any[] = []
  for (const [itemId, history] of Object.entries(byItem)) {
    if (history.length < 2) continue
    const sorted = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const latest = sorted[0]
    // The previous DIFFERENT price — a re-order at the same price isn't a "change".
    const previous = sorted.find((h) => h.cost !== latest.cost)
    if (!previous) continue
    const changePct = previous.cost ? round2(((latest.cost - previous.cost) / previous.cost) * 100) : null
    out.push({
      stock_item_id: itemId, name: nameById[itemId]?.name, supplier: nameById[itemId]?.supplier,
      latest_cost: round2(latest.cost), latest_date: latest.date,
      previous_cost: round2(previous.cost), previous_date: previous.date,
      change_amount: round2(latest.cost - previous.cost), change_pct: changePct,
      confirmed_purchase_count: history.length,
    })
  }
  return out.sort((a, b) => Math.abs(b.change_pct ?? 0) - Math.abs(a.change_pct ?? 0))
}

// K27 — "flag cost increases while price unchanged, but never auto-change
// prices": cross-references the confirmed cost increases above against
// menu_stock_components (the existing menu-item -> stock-item recipe
// link) and each menu item's own current selling price (untouched here).
export async function getCostIncreaseVsPriceFlags(admin: any, businessId: string) {
  const changes = await getSupplierPriceChanges(admin, businessId)
  const increases = changes.filter((c) => c.change_pct != null && c.change_pct > 0)
  if (!increases.length) return []

  const { data: components } = await admin
    .from('menu_stock_components')
    .select('stock_item_id, quantity_per_item, menu_items!inner(id, name, price, van_id, vans!inner(business_id))')
    .eq('menu_items.vans.business_id', businessId)
    .in('stock_item_id', increases.map((c) => c.stock_item_id))

  const byStockItem: Record<string, any[]> = {}
  for (const row of components ?? []) {
    byStockItem[row.stock_item_id] ??= []
    byStockItem[row.stock_item_id].push(row)
  }

  const out: any[] = []
  for (const change of increases) {
    for (const comp of byStockItem[change.stock_item_id] ?? []) {
      out.push({
        menu_item_id: comp.menu_items.id, menu_item_name: comp.menu_items.name, current_price: comp.menu_items.price,
        stock_item_id: change.stock_item_id, stock_item_name: change.name,
        cost_change_pct: change.change_pct, latest_cost: change.latest_cost, previous_cost: change.previous_cost,
        quantity_per_item: comp.quantity_per_item,
      })
    }
  }
  return out
}

// K29 — menu margin review: selling price, known cost (derived from
// stock_items.cost_price via the recipe link — the same "latest confirmed
// cost" convention Phase H's COGS calculation already uses), known gross
// contribution, and cost coverage (does this item even have a recipe
// linked at all).
export async function getMenuMarginReview(admin: any, businessId: string, vanIds: string[]) {
  if (!vanIds.length) return { items: [], coverage_pct: 0 }
  const { data: menuItems } = await admin.from('menu_items').select('id, name, price, van_id, vans!inner(business_id, name)').eq('vans.business_id', businessId).in('van_id', vanIds)
  if (!menuItems?.length) return { items: [], coverage_pct: 0 }

  const { data: components } = await admin.from('menu_stock_components').select('menu_item_id, stock_item_id, quantity_per_item, stock_items(cost_price)').in('menu_item_id', menuItems.map((m: any) => m.id))
  const costByMenuItem: Record<string, { cost: number; hasAnyMissingCost: boolean }> = {}
  for (const c of components ?? []) {
    costByMenuItem[c.menu_item_id] ??= { cost: 0, hasAnyMissingCost: false }
    if (c.stock_items?.cost_price == null) costByMenuItem[c.menu_item_id].hasAnyMissingCost = true
    else costByMenuItem[c.menu_item_id].cost = round2(costByMenuItem[c.menu_item_id].cost + c.stock_items.cost_price * (c.quantity_per_item ?? 0))
  }

  const items = menuItems.map((m: any) => {
    const costInfo = costByMenuItem[m.id]
    const hasRecipe = !!costInfo
    const knownCost = hasRecipe && !costInfo.hasAnyMissingCost ? costInfo.cost : null
    return {
      menu_item_id: m.id, name: m.name, van_id: m.van_id, van_name: m.vans?.name, selling_price: m.price,
      known_cost: knownCost,
      known_gross_contribution: knownCost != null ? round2(m.price - knownCost) : null,
      margin_pct: knownCost != null && m.price ? round2(((m.price - knownCost) / m.price) * 100) : null,
      cost_coverage: hasRecipe ? (costInfo.hasAnyMissingCost ? 'PARTIAL — some ingredients have no cost_price set' : 'FULL') : 'NONE — no recipe linked (see /dashboard/menu)',
    }
  })
  const covered = items.filter((i: any) => i.known_cost != null).length
  return { items, coverage_pct: round2((covered / items.length) * 100) }
}

// K31 — price simulator: pure arithmetic, current vs proposed price
// against a known cost. Never persists or publishes anything — the
// caller (the API route) never writes to menu_items.
export function simulatePriceChange(currentPrice: number, proposedPrice: number, knownCost: number | null) {
  const currentContribution = knownCost != null ? round2(currentPrice - knownCost) : null
  const proposedContribution = knownCost != null ? round2(proposedPrice - knownCost) : null
  return {
    current_price: currentPrice, proposed_price: proposedPrice, known_cost: knownCost,
    current_gross_contribution: currentContribution,
    proposed_gross_contribution: proposedContribution,
    contribution_difference: currentContribution != null && proposedContribution != null ? round2(proposedContribution - currentContribution) : null,
    disclosure: 'This is a mathematical comparison only. It assumes the same sales volume at the new price — it does not (and cannot) predict how demand would actually change.',
  }
}
