// @ts-nocheck
// Demand planning (G21–G26). Transparent statistics only — a plain
// average of real comparable trading days, never a black-box model
// (G21). Every suggestion is stored (demand_estimates) with the exact
// sample values used, so it's fully explainable (G41) and never silently
// rewritten after the fact (G44).
import { scheduleDayOfWeek } from '@/lib/schedule/dayOfWeek'
import { round2 } from './analytics'

const DEFAULT_SAMPLE_SIZE = 6
const REVENUE_EXCLUDED_STATUSES = ['cancelled']

// Same van, same stop, same weekday — the most literal reading of G22's
// "same weekday, same route, same stop, same van" comparability rule.
async function getComparableStopDates(admin: any, vanScheduleId: string, targetDate: string, sampleSize: number) {
  const dow = scheduleDayOfWeek(new Date(`${targetDate}T00:00:00Z`))
  const { data: orders } = await admin.from('orders').select('service_date, status').eq('pickup_stop_id', vanScheduleId).lt('service_date', targetDate)
  const dates = [...new Set((orders ?? []).filter((o: any) => !REVENUE_EXCLUDED_STATUSES.includes(o.status)).map((o: any) => o.service_date))]
    .filter(d => scheduleDayOfWeek(new Date(`${d}T00:00:00Z`)) === dow)
    .sort().reverse().slice(0, sampleSize)
  return dates
}

// Quantity of a stock item sold across a set of orders, via
// menu_stock_components (Phase C's optional recipe link). Returns null
// (not 0) when no recipe links this stock item to any menu item at
// all — "no data configured" is a different fact from "zero sold".
async function stockQuantityForOrders(admin: any, orderIds: string[], stockItemId: string): Promise<number | null> {
  const { data: components } = await admin.from('menu_stock_components').select('menu_item_id, quantity_per_item').eq('stock_item_id', stockItemId)
  if (!components?.length) return null
  if (!orderIds.length) return 0
  const menuItemIds = components.map((c: any) => c.menu_item_id)
  const qtyPerMenuItem = Object.fromEntries(components.map((c: any) => [c.menu_item_id, c.quantity_per_item]))
  const { data: items } = await admin.from('order_items').select('menu_item_id, quantity').in('order_id', orderIds.slice(0, 500)).in('menu_item_id', menuItemIds)
  return (items ?? []).reduce((s: number, it: any) => s + (it.quantity ?? 0) * (qtyPerMenuItem[it.menu_item_id] ?? 0), 0)
}

// G21–G23, G41–G43 — the core estimate for one stock item at one stop on
// one future date. Persists the result (or reuses today's if already
// computed — idempotent per (van, target_date, stock_item), matching
// demand_estimates' UNIQUE constraint) so G44's "never rewrite an old
// prediction" holds even across repeated calls the same day.
export async function computeDemandEstimate(admin: any, businessId: string, vanId: string, vanScheduleId: string, targetDate: string, stockItemId: string, bufferPct = 10) {
  const { data: existing } = await admin.from('demand_estimates').select('*').eq('van_id', vanId).eq('target_date', targetDate).eq('stock_item_id', stockItemId).maybeSingle()
  if (existing) return { ...existing, cold_start: existing.sample_size === 0 && existing.baseline_quantity === null }

  const comparableDates = await getComparableStopDates(admin, vanScheduleId, targetDate, DEFAULT_SAMPLE_SIZE)

  if (comparableDates.length === 0) {
    const { data: stockItem } = await admin.from('stock_items').select('name, unit').eq('id', stockItemId).maybeSingle()
    const record = { business_id: businessId, van_id: vanId, van_schedule_id: vanScheduleId, target_date: targetDate, stock_item_id: stockItemId, method: 'comparable_days_average', sample_size: 0, sample_values: [], baseline_quantity: null, buffer_pct: bufferPct, suggested_quantity: null }
    const { data: saved } = await admin.from('demand_estimates').insert(record).select().single()
    return { ...saved, item_name: stockItem?.name, unit: stockItem?.unit, cold_start: true, message: 'FoodTaxi needs more trading history at this stop before it can provide a reliable demand estimate.' }
  }

  const { data: orders } = await admin.from('orders').select('id, service_date, status').eq('pickup_stop_id', vanScheduleId).in('service_date', comparableDates)
  const validOrders = (orders ?? []).filter((o: any) => !REVENUE_EXCLUDED_STATUSES.includes(o.status))
  const sampleValues: number[] = []
  for (const date of comparableDates) {
    const ids = validOrders.filter((o: any) => o.service_date === date).map((o: any) => o.id)
    const qty = await stockQuantityForOrders(admin, ids, stockItemId)
    if (qty === null) {
      return { cold_start: false, no_recipe: true, message: 'No recipe links this stock item to a menu item yet (Menu → recipe components) — demand cannot be calculated without it.' }
    }
    sampleValues.push(qty)
  }

  const baseline = sampleValues.reduce((s, v) => s + v, 0) / sampleValues.length
  const suggested = Math.ceil(baseline * (1 + bufferPct / 100))

  const { data: saved, error } = await admin.from('demand_estimates').insert({
    business_id: businessId, van_id: vanId, van_schedule_id: vanScheduleId, target_date: targetDate, stock_item_id: stockItemId,
    method: 'comparable_days_average', sample_size: sampleValues.length, sample_values: sampleValues,
    baseline_quantity: round2(baseline), buffer_pct: bufferPct, suggested_quantity: suggested,
  }).select().single()
  if (error) throw error

  const { data: stockItem } = await admin.from('stock_items').select('name, unit').eq('id', stockItemId).maybeSingle()
  return { ...saved, item_name: stockItem?.name, unit: stockItem?.unit, cold_start: false }
}

// G24, G25 — the full loading plan for a van on a date: every stock item
// with a configured recipe, its suggested quantity, and how that compares
// to what's actually available right now (van's own location + all
// warehouse-type locations) — a shortfall, never an automatic transfer.
export async function getLoadingPlan(admin: any, businessId: string, vanId: string, vanScheduleId: string, targetDate: string, bufferPct = 10) {
  const { data: recipeLinks } = await admin.from('menu_stock_components').select('stock_item_id, menu_items!inner(van_id)').eq('menu_items.van_id', vanId)
  const stockItemIds = [...new Set((recipeLinks ?? []).map((r: any) => r.stock_item_id))]
  if (!stockItemIds.length) return { items: [], message: 'No menu items have recipe components configured yet (Menu → recipe components), so no loading plan can be suggested.' }

  const { data: vanLocation } = await admin.from('stock_locations').select('id').eq('van_id', vanId).maybeSingle()
  const { data: warehouseLocations } = await admin.from('stock_locations').select('id').eq('business_id', businessId).eq('type', 'warehouse')
  const warehouseIds = (warehouseLocations ?? []).map((l: any) => l.id)

  const items = []
  for (const stockItemId of stockItemIds) {
    const estimate = await computeDemandEstimate(admin, businessId, vanId, vanScheduleId, targetDate, stockItemId, bufferPct)
    const { data: levels } = await admin.from('stock_levels').select('location_id, quantity').eq('stock_item_id', stockItemId)
    const vanQty = (levels ?? []).find((l: any) => l.location_id === vanLocation?.id)?.quantity ?? 0
    const warehouseQty = (levels ?? []).filter((l: any) => warehouseIds.includes(l.location_id)).reduce((s: number, l: any) => s + (l.quantity ?? 0), 0)
    const required = estimate.suggested_quantity
    const shortfall = required !== null && required !== undefined ? Math.max(0, round2(required - vanQty - warehouseQty)) : null

    items.push({
      stock_item_id: stockItemId, item_name: estimate.item_name, unit: estimate.unit,
      suggested_quantity: required, sample_size: estimate.sample_size, sample_values: estimate.sample_values,
      baseline_quantity: estimate.baseline_quantity, buffer_pct: estimate.buffer_pct,
      cold_start: estimate.cold_start, message: estimate.message ?? null,
      currently_on_van: round2(vanQty), currently_in_warehouse: round2(warehouseQty), shortfall,
    })
  }
  return { target_date: targetDate, items }
}
