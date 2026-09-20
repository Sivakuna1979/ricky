// @ts-nocheck
// I5 — the customer profile, computed live from `orders` (never cached
// on crm_customers — see lib/crm/identity.ts). Revenue rule matches
// Phase B/H exactly: sum(total) excluding status='cancelled', net of any
// matching Phase H refunds — "recorded spend", never called "profit" or
// "value" beyond the historical, factual figure it is (I51).
import { round2, sum } from '@/lib/finance/money'
import { REVENUE_EXCLUDED_STATUSES } from '@/lib/finance/revenue'

async function fetchOrdersForCustomer(admin: any, vanIds: string[], crmCustomer: { normalized_phone: string | null; email: string | null; customer_id: string | null }) {
  if (!vanIds.length) return []
  const clauses: string[] = []
  if (crmCustomer.normalized_phone) clauses.push(`guest_phone.eq.${crmCustomer.normalized_phone}`)
  if (crmCustomer.email) clauses.push(`guest_email.eq.${crmCustomer.email}`)
  if (crmCustomer.customer_id) clauses.push(`customer_id.eq.${crmCustomer.customer_id}`)
  if (!clauses.length) return []

  const { data, error } = await admin.from('orders')
    .select('id, van_id, total, status, created_at, order_items(name, quantity)')
    .in('van_id', vanIds).or(clauses.join(','))
    .order('created_at', { ascending: true })
  if (error) throw new Error('orders_query_failed')
  return data ?? []
}

async function fetchRefundTotal(admin: any, businessId: string, orderIds: string[]) {
  if (!orderIds.length) return 0
  const { data } = await admin.from('refunds').select('amount').eq('business_id', businessId).in('order_id', orderIds.slice(0, 1000))
  return sum((data ?? []).map((r: any) => r.amount))
}

export async function getCustomerProfile(admin: any, businessId: string, crmCustomer: any) {
  const { data: vans } = await admin.from('vans').select('id, name').eq('business_id', businessId)
  const vanIds = (vans ?? []).map((v: any) => v.id)
  const vanNameById: Record<string, string> = Object.fromEntries((vans ?? []).map((v: any) => [v.id, v.name]))

  const allOrders = await fetchOrdersForCustomer(admin, vanIds, crmCustomer)
  const validOrders = allOrders.filter((o: any) => !REVENUE_EXCLUDED_STATUSES.includes(o.status))
  const refundTotal = await fetchRefundTotal(admin, businessId, validOrders.map((o: any) => o.id))

  const grossSpend = sum(validOrders.map((o: any) => o.total))
  const recordedSpend = round2(grossSpend - refundTotal)
  const orderCount = validOrders.length

  const vanTally: Record<string, number> = {}
  const itemTally: Record<string, number> = {}
  for (const o of validOrders) {
    vanTally[o.van_id] = (vanTally[o.van_id] ?? 0) + 1
    for (const it of o.order_items ?? []) itemTally[it.name] = (itemTally[it.name] ?? 0) + (it.quantity ?? 1)
  }
  const preferredVanId = Object.entries(vanTally).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] ?? null
  const favouriteItems = Object.entries(itemTally).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5).map(([name, quantity]) => ({ name, quantity }))

  return {
    order_count: orderCount,
    recorded_spend: recordedSpend,
    average_order_value: orderCount ? round2(recordedSpend / orderCount) : 0,
    first_order_date: validOrders[0]?.created_at ?? null,
    last_order_date: validOrders[orderCount - 1]?.created_at ?? null,
    preferred_van: preferredVanId ? { id: preferredVanId, name: vanNameById[preferredVanId] } : null,
    favourite_items: favouriteItems,
  }
}
