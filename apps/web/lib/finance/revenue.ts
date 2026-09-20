// @ts-nocheck
// H4–H6 — sales revenue. Reuses Phase B's exact authoritative rule
// (app/api/analytics/summary): sum(orders.total) for every order except
// status='cancelled', dated by created_at — the same definition Phase B's
// own dashboard and Phase D's automations already use, never redefined
// here. The one addition Phase H makes is subtracting recorded refunds
// (H22 — "prevent refunded sales inflating net revenue"), which Phase B
// never had to handle since `refunds` didn't exist yet.
import { round2, sum } from './money'

export const REVENUE_EXCLUDED_STATUSES = ['cancelled']

// H21 — provider-neutral payment categorisation. 'card_at_van' is
// explicitly labelled "card-recorded", never "verified" or "settled" —
// FoodTaxi has no card-terminal integration, so it only knows what the
// till recorded, not what actually settled (H19/H3).
export function paymentCategory(order: { payment_method: string | null }): 'cash' | 'card_recorded' | 'verified_online' | 'other' {
  if (order.payment_method === 'cash_at_van') return 'cash'
  if (order.payment_method === 'card_at_van') return 'card_recorded'
  if (order.payment_method === 'card_online') return 'verified_online' // captured via Stripe webhook (payments.status)
  return 'other'
}

export async function fetchRevenueOrders(admin: any, vanIds: string[], startIso: string, endIso: string) {
  if (!vanIds.length) return []
  const { data, error } = await admin
    .from('orders')
    .select('id, van_id, total, subtotal, vat_amount, status, payment_method, source, created_at')
    .in('van_id', vanIds).gte('created_at', startIso).lt('created_at', endIso)
  if (error) throw new Error('orders_query_failed')
  return (data ?? []).filter((o: any) => !REVENUE_EXCLUDED_STATUSES.includes(o.status))
}

async function fetchRefundsForOrders(admin: any, businessId: string, orderIds: string[]) {
  if (!orderIds.length) return []
  const { data } = await admin.from('refunds').select('order_id, amount, method').eq('business_id', businessId).in('order_id', orderIds.slice(0, 1000))
  return data ?? []
}

// H4–H6, H20 — "what did I take today" style summary: gross revenue,
// refunds, net revenue, orders, AOV, and a payment-category breakdown.
export async function getSalesSummary(admin: any, businessId: string, opts: { vanIds: string[]; startIso: string; endIso: string }) {
  const orders = await fetchRevenueOrders(admin, opts.vanIds, opts.startIso, opts.endIso)
  const refunds = await fetchRefundsForOrders(admin, businessId, orders.map((o: any) => o.id))
  const refundsByOrder: Record<string, number> = {}
  for (const r of refunds) refundsByOrder[r.order_id] = (refundsByOrder[r.order_id] ?? 0) + (r.amount ?? 0)

  const grossRevenue = sum(orders.map((o: any) => o.total))
  const refundTotal = sum(refunds.map((r: any) => r.amount))
  const netRevenue = round2(grossRevenue - refundTotal)
  const orderCount = orders.length
  const vatTotal = sum(orders.map((o: any) => o.vat_amount))

  const byCategory: Record<string, { revenue: number; orders: number }> = { cash: { revenue: 0, orders: 0 }, card_recorded: { revenue: 0, orders: 0 }, verified_online: { revenue: 0, orders: 0 }, other: { revenue: 0, orders: 0 } }
  for (const o of orders) {
    const cat = paymentCategory(o)
    byCategory[cat].revenue += o.total ?? 0
    byCategory[cat].orders += 1
  }
  for (const cat of Object.keys(byCategory)) byCategory[cat].revenue = round2(byCategory[cat].revenue)

  return {
    gross_revenue: grossRevenue,
    refunds: refundTotal,
    net_revenue: netRevenue,
    orders: orderCount,
    average_order_value: orderCount ? round2(grossRevenue / orderCount) : 0,
    output_vat_recorded: vatTotal,
    by_payment_category: byCategory,
    refunds_by_order: refundsByOrder,
  }
}

// H16 — cash sales/refunds for one van/day, used by cash reconciliation.
export async function getCashFigures(admin: any, businessId: string, vanId: string, serviceDate: string) {
  const startIso = `${serviceDate}T00:00:00.000Z`
  const endIso = new Date(new Date(`${serviceDate}T00:00:00Z`).getTime() + 86400000).toISOString()
  const orders = await fetchRevenueOrders(admin, [vanId], startIso, endIso)
  const cashOrders = orders.filter((o: any) => paymentCategory(o) === 'cash')
  const cashSales = sum(cashOrders.map((o: any) => o.total))
  const refunds = await fetchRefundsForOrders(admin, businessId, cashOrders.map((o: any) => o.id))
  const cashRefunds = sum(refunds.filter((r: any) => r.method === 'cash').map((r: any) => r.amount))
  return { cashSales, cashRefunds }
}

// H19 — card-recorded total for one van/day, used by card reconciliation.
export async function getCardRecordedTotal(admin: any, vanId: string, serviceDate: string) {
  const startIso = `${serviceDate}T00:00:00.000Z`
  const endIso = new Date(new Date(`${serviceDate}T00:00:00Z`).getTime() + 86400000).toISOString()
  const orders = await fetchRevenueOrders(admin, [vanId], startIso, endIso)
  return sum(orders.filter((o: any) => paymentCategory(o) === 'card_recorded').map((o: any) => o.total))
}
