// @ts-nocheck
// I1/I93 — crm_customers is populated going forward from the order-collected
// hook (see app/api/orders/[id]/status), independent of whether loyalty is
// enabled — CRM identity tracking is a base feature, loyalty earning is a
// layer on top of it. For orders that existed before Phase I shipped, this
// does a bounded, idempotent backfill: it only ever INSERTs identities that
// don't have a crm_customers row yet, and is cheap to call repeatedly (after
// the first pass there is nothing left to do). Existing order history is
// read, never modified (I93 — "preserve existing customer/order history").
import { findOrCreateCrmCustomer, computeIdentityKey } from './identity'

const BACKFILL_LIMIT = 3000

export async function ensureCrmCustomersBackfilled(admin: any, businessId: string) {
  const { data: vans } = await admin.from('vans').select('id').eq('business_id', businessId)
  const vanIds = (vans ?? []).map((v: any) => v.id)
  if (!vanIds.length) return

  const { data: existing } = await admin.from('crm_customers').select('identity_key').eq('business_id', businessId)
  const known = new Set((existing ?? []).map((c: any) => c.identity_key))

  const { data: orders } = await admin.from('orders')
    .select('guest_name, guest_phone, guest_email, customer_id, created_at')
    .in('van_id', vanIds).order('created_at', { ascending: false }).limit(BACKFILL_LIMIT)

  const seenThisRun = new Set<string>()
  for (const o of orders ?? []) {
    if (!o.guest_phone && !o.guest_email) continue
    const key = computeIdentityKey(o.guest_phone, o.guest_email)
    if (!key || known.has(key) || seenThisRun.has(key)) continue
    seenThisRun.add(key)
    await findOrCreateCrmCustomer(admin, businessId, { phone: o.guest_phone, email: o.guest_email, displayName: o.guest_name, customerId: o.customer_id })
  }
}
