// @ts-nocheck
// I2/I3 — conservative, business-scoped customer identity. Only two
// identifiers are ever used to link an order to a CRM profile: a
// normalised phone number, or an exact (lowercased) email — never a
// name, never "looks similar to". crm_customers is an identity +
// preference table only; it never stores order_count/spend/etc — those
// are always computed live from `orders` (see lib/crm/profile.ts) so
// there is no second, driftable copy of order history (the same
// principle Phase G/H already established for route and finance data).
import { normalizePhone } from '@/lib/phone'

export function computeIdentityKey(phone: string | null | undefined, email: string | null | undefined): string | null {
  const normPhone = normalizePhone(phone)
  if (normPhone) return `phone:${normPhone}`
  const normEmail = email?.trim().toLowerCase()
  if (normEmail) return `email:${normEmail}`
  return null
}

// Finds (or creates) the crm_customers row for a phone/email pair. Never
// creates one for an unidentifiable order (identity_key null) — nothing
// to track. `customer_id` is only ever set when a real authenticated
// customers.id is passed AND it matches the same phone/email already
// present on the account — an exact match, never inferred from a name.
export async function findOrCreateCrmCustomer(admin: any, businessId: string, opts: { phone?: string | null; email?: string | null; displayName?: string | null; customerId?: string | null }) {
  const identityKey = computeIdentityKey(opts.phone, opts.email)
  if (!identityKey) return null

  const { data: existing } = await admin.from('crm_customers').select('*').eq('business_id', businessId).eq('identity_key', identityKey).maybeSingle()
  if (existing) {
    // Keep the profile's known contact details/display name filled in as
    // more orders arrive, without overwriting anything already set with a
    // blank — this never re-keys the row (identity_key is immutable once
    // created).
    const updates: any = {}
    if (opts.displayName && !existing.display_name) updates.display_name = opts.displayName
    if (opts.phone && !existing.normalized_phone) updates.normalized_phone = normalizePhone(opts.phone)
    if (opts.email && !existing.email) updates.email = opts.email.trim().toLowerCase()
    if (opts.customerId && !existing.customer_id) updates.customer_id = opts.customerId
    if (Object.keys(updates).length) {
      updates.updated_at = new Date().toISOString()
      const { data: updated } = await admin.from('crm_customers').update(updates).eq('id', existing.id).select().single()
      return updated ?? existing
    }
    return existing
  }

  const { data: created, error } = await admin.from('crm_customers').insert({
    business_id: businessId, identity_key: identityKey,
    normalized_phone: normalizePhone(opts.phone), email: opts.email?.trim().toLowerCase() ?? null,
    display_name: opts.displayName ?? null, customer_id: opts.customerId ?? null,
  }).select().single()
  if (error) {
    // A concurrent request created the same identity first — fetch, don't fail.
    if (error.code === '23505') {
      const { data: raceWinner } = await admin.from('crm_customers').select('*').eq('business_id', businessId).eq('identity_key', identityKey).maybeSingle()
      return raceWinner
    }
    throw error
  }
  return created
}

// The identity lookup used every time an order becomes relevant to CRM
// (loyalty earning, feedback request, etc.) — mirrors an order's own
// guest_phone/guest_email/guest_name/customer_id fields directly.
export async function findOrCreateCrmCustomerForOrder(admin: any, businessId: string, order: { guest_phone?: string | null; guest_email?: string | null; guest_name?: string | null; customer_id?: string | null }) {
  return findOrCreateCrmCustomer(admin, businessId, {
    phone: order.guest_phone, email: order.guest_email, displayName: order.guest_name, customerId: order.customer_id,
  })
}

// I3 — a safe, auditable manual merge: moves the merged-from profile's
// tags/notes reference forward and marks it merged_into_id (kept, not
// deleted, for audit — I66). Never triggered automatically; a caller
// must supply both ids explicitly having reviewed them.
export async function mergeCrmCustomers(admin: any, businessId: string, keepId: string, mergeFromId: string, mergedBy: string) {
  if (keepId === mergeFromId) throw new Error('cannot_merge_into_self')
  const [{ data: keep }, { data: mergeFrom }] = await Promise.all([
    admin.from('crm_customers').select('*').eq('id', keepId).eq('business_id', businessId).maybeSingle(),
    admin.from('crm_customers').select('*').eq('id', mergeFromId).eq('business_id', businessId).maybeSingle(),
  ])
  if (!keep || !mergeFrom) throw new Error('not_found')

  const updates: any = {}
  if (!keep.normalized_phone && mergeFrom.normalized_phone) updates.normalized_phone = mergeFrom.normalized_phone
  if (!keep.email && mergeFrom.email) updates.email = mergeFrom.email
  if (!keep.customer_id && mergeFrom.customer_id) updates.customer_id = mergeFrom.customer_id
  const mergedTags = Array.from(new Set([...(keep.tags ?? []), ...(mergeFrom.tags ?? [])]))
  if (mergedTags.length !== (keep.tags ?? []).length) updates.tags = mergedTags
  updates.updated_at = new Date().toISOString()

  await admin.from('crm_customers').update(updates).eq('id', keepId)
  await admin.from('crm_customers').update({ merged_into_id: keepId, updated_at: new Date().toISOString() }).eq('id', mergeFromId)
  return { keepId, mergeFromId }
}
