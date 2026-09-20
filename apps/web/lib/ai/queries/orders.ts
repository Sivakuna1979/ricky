// @ts-nocheck
// Shared order-fetching helper for the AI sales tools — one place applying
// the same revenue rule established in Phase B's analytics route (E7:
// "use the same documented revenue rules as Phase B analytics"). The
// server computes every number; the AI only ever explains what's returned
// here, never sums raw rows itself.
const REVENUE_EXCLUDED_STATUSES = ['cancelled']

export async function fetchRevenueOrders(admin: any, vanIds: string[], startIso: string, endIso: string) {
  if (!vanIds.length) return []
  const { data, error } = await admin
    .from('orders')
    .select('id, van_id, total, status, payment_method, source, created_at')
    .in('van_id', vanIds)
    .gte('created_at', startIso)
    .lt('created_at', endIso)
  if (error) throw new Error('orders_query_failed')
  return (data ?? []).filter((o: any) => !REVENUE_EXCLUDED_STATUSES.includes(o.status))
}

export function round2(n: number) { return Math.round((n ?? 0) * 100) / 100 }

export function summarizeOrders(orders: any[]) {
  const revenue = round2(orders.reduce((s, o) => s + (o.total ?? 0), 0))
  const count = orders.length
  return { revenue, orders: count, average_order_value: count ? round2(revenue / count) : 0 }
}
