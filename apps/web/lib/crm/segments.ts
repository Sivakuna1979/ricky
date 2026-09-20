// @ts-nocheck
// I28–I30 — deterministic customer segments, computed entirely from safe
// fields (order count, recorded spend, last/first order date, van). No
// segment is ever inferred by an LLM, and none of these fields can encode
// a sensitive personal characteristic (I30) — they are pure order-history
// arithmetic.
import { round2, sum } from '@/lib/finance/money'
import { REVENUE_EXCLUDED_STATUSES } from '@/lib/finance/revenue'
import { computeIdentityKey } from './identity'
import { ensureCrmCustomersBackfilled } from './backfill'

export const SEGMENT_DEFINITIONS = [
  { key: 'new', label: 'New', description: 'First (and so far only) order in the last 30 days.' },
  { key: 'active', label: 'Active', description: 'Ordered within the last 30 days.' },
  { key: 'regular', label: 'Regular', description: '3+ orders, most recent within 60 days.' },
  { key: 'lapsed', label: 'Lapsed', description: 'No order in the last 60 days (configurable).' },
  { key: 'high_frequency', label: 'High frequency', description: '10+ orders in the last 90 days.' },
  { key: 'high_spend', label: 'High recorded spend', description: 'Recorded spend at or above a threshold.' },
] as const

function daysSince(dateStr: string | null, now: number) {
  if (!dateStr) return Infinity
  return (now - new Date(dateStr).getTime()) / 86400000
}

// One pass over the business's order history, grouped by identity key —
// far cheaper than one query per customer, and the same "aggregate then
// group in memory" approach Phase B/G/H's own analytics already use.
export async function getCustomerAggregates(admin: any, businessId: string, vanIds: string[]) {
  const aggregates = new Map<string, { order_count: number; recorded_spend: number; first_order_date: string; last_order_date: string; van_ids: Set<string> }>()
  if (!vanIds.length) return aggregates

  const { data: orders } = await admin.from('orders')
    .select('id, van_id, guest_phone, guest_email, total, status, created_at')
    .in('van_id', vanIds).order('created_at', { ascending: true }).limit(20000)

  const validOrders = (orders ?? []).filter((o: any) => !REVENUE_EXCLUDED_STATUSES.includes(o.status))
  const orderIds = validOrders.map((o: any) => o.id)
  const { data: refunds } = orderIds.length ? await admin.from('refunds').select('order_id, amount').eq('business_id', businessId).in('order_id', orderIds.slice(0, 5000)) : { data: [] }
  const refundByOrder: Record<string, number> = {}
  for (const r of refunds ?? []) refundByOrder[r.order_id] = (refundByOrder[r.order_id] ?? 0) + r.amount

  for (const o of validOrders) {
    const key = computeIdentityKey(o.guest_phone, o.guest_email)
    if (!key) continue
    const net = round2((o.total ?? 0) - (refundByOrder[o.id] ?? 0))
    const existing = aggregates.get(key)
    if (!existing) {
      aggregates.set(key, { order_count: 1, recorded_spend: net, first_order_date: o.created_at, last_order_date: o.created_at, van_ids: new Set([o.van_id]) })
    } else {
      existing.order_count += 1
      existing.recorded_spend = round2(existing.recorded_spend + net)
      existing.last_order_date = o.created_at // orders are fetched oldest-first
      existing.van_ids.add(o.van_id)
    }
  }
  return aggregates
}

export function computeSegmentMembership(aggregate: { order_count: number; recorded_spend: number; last_order_date: string } | undefined, segmentKey: string, opts: { lapsedDays?: number; highSpendThreshold?: number } = {}) {
  const now = Date.now()
  if (!aggregate) return false
  const daysSinceLast = daysSince(aggregate.last_order_date, now)
  switch (segmentKey) {
    case 'new': return aggregate.order_count === 1 && daysSinceLast <= 30
    case 'active': return daysSinceLast <= 30
    case 'regular': return aggregate.order_count >= 3 && daysSinceLast <= 60
    case 'lapsed': return daysSinceLast > (opts.lapsedDays ?? 60)
    case 'high_frequency': return aggregate.order_count >= 10 && daysSinceLast <= 90
    case 'high_spend': return aggregate.recorded_spend >= (opts.highSpendThreshold ?? 100)
    default: return true // unrecognised/custom segment — caller applies its own filter
  }
}

// I4/I29 — the CRM customer list: search/filter/sort/paginate, built from
// crm_customers + the live aggregates above. `includeContact` gates
// whether email/phone are actually returned (I4 — "do not expose
// unnecessary PII in list views"); enforced by the caller checking
// view_customer_contact, not by this function, but the flag exists so a
// caller without that permission can still get names/segments without
// contact fields at all.
export async function listCrmCustomers(admin: any, businessId: string, opts: {
  search?: string; segment?: string; sort?: string; page?: number; pageSize?: number; includeContact?: boolean
}) {
  await ensureCrmCustomersBackfilled(admin, businessId)
  const { data: vans } = await admin.from('vans').select('id').eq('business_id', businessId)
  const vanIds = (vans ?? []).map((v: any) => v.id)
  const aggregates = await getCustomerAggregates(admin, businessId, vanIds)

  let query = admin.from('crm_customers').select('*').eq('business_id', businessId).is('merged_into_id', null)
  if (opts.search) {
    const s = opts.search.trim()
    query = query.or(`display_name.ilike.%${s}%,normalized_phone.ilike.%${s}%,email.ilike.%${s}%`)
  }
  const { data: rows } = await query
  let customers = (rows ?? []).map((c: any) => {
    const agg = aggregates.get(c.identity_key)
    return {
      id: c.id, _identity_key: c.identity_key, display_name: c.display_name,
      phone: opts.includeContact ? c.normalized_phone : null,
      email: opts.includeContact ? c.email : null,
      tags: c.tags, loyalty_enrolled: c.loyalty_enrolled,
      marketing_eligible: c.marketing_email_opt_in || c.marketing_whatsapp_opt_in || c.marketing_sms_opt_in,
      order_count: agg?.order_count ?? 0, recorded_spend: agg?.recorded_spend ?? 0,
      last_order_date: agg?.last_order_date ?? null, first_order_date: agg?.first_order_date ?? null,
    }
  })

  if (opts.segment && opts.segment !== 'all') {
    customers = customers.filter((c: any) => computeSegmentMembership(aggregates.get(c._identity_key), opts.segment!))
  }
  customers = customers.map(({ _identity_key, ...rest }: any) => rest)

  const sort = opts.sort ?? 'last_order_desc'
  customers.sort((a: any, b: any) => {
    if (sort === 'spend_desc') return b.recorded_spend - a.recorded_spend
    if (sort === 'orders_desc') return b.order_count - a.order_count
    if (sort === 'name_asc') return (a.display_name ?? '').localeCompare(b.display_name ?? '')
    return new Date(b.last_order_date ?? 0).getTime() - new Date(a.last_order_date ?? 0).getTime()
  })

  const page = opts.page ?? 1
  const pageSize = Math.min(opts.pageSize ?? 50, 200)
  const start = (page - 1) * pageSize
  return { total: customers.length, page, pageSize, customers: customers.slice(start, start + pageSize) }
}
