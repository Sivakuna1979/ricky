// @ts-nocheck
// I9–I15 — loyalty programme logic. Both supported earning models
// (points-per-spend, visit stamps) are expressed as the same points_delta
// on the shared ledger (see the migration's apply_loyalty_transaction()).
// Every balance change goes through that one RPC — nothing here ever
// writes loyalty_accounts.balance directly.
import { round2 } from '@/lib/finance/money'

const DEFAULT_SETTINGS = {
  enabled: false, programme_name: 'Loyalty Rewards', earning_method: 'points_per_spend',
  points_per_pound: 1, min_qualifying_order: 0, reward_threshold: 100,
  reward_description: '£5 off your next order', reward_value: 5, reward_value_type: 'fixed_amount',
  expiry_days: null, eligible_channels: ['pos', 'online', 'guest', 'whatsapp'], eligible_van_ids: null, terms_text: null,
}

export async function getLoyaltySettings(admin: any, businessId: string) {
  const { data } = await admin.from('loyalty_settings').select('*').eq('business_id', businessId).maybeSingle()
  return data ?? { business_id: businessId, ...DEFAULT_SETTINGS }
}

export async function getOrCreateLoyaltyAccount(admin: any, businessId: string, crmCustomerId: string) {
  const { data: existing } = await admin.from('loyalty_accounts').select('*').eq('crm_customer_id', crmCustomerId).maybeSingle()
  if (existing) return existing
  const { data: created, error } = await admin.from('loyalty_accounts').insert({ business_id: businessId, crm_customer_id: crmCustomerId }).select().single()
  if (error) {
    if (error.code === '23505') {
      const { data: raceWinner } = await admin.from('loyalty_accounts').select('*').eq('crm_customer_id', crmCustomerId).maybeSingle()
      return raceWinner
    }
    throw error
  }
  return created
}

function isOrderEligible(settings: any, order: { van_id: string; source: string | null; total: number }) {
  if (order.total < (settings.min_qualifying_order ?? 0)) return false
  if (settings.eligible_van_ids?.length && !settings.eligible_van_ids.includes(order.van_id)) return false
  const channels: string[] = settings.eligible_channels ?? []
  if (channels.length && order.source && !channels.includes(order.source)) return false
  return true
}

// I12 — earning trigger point: called once, from the single place an
// order becomes 'collected' (app/api/orders/[id]/status), for every
// channel (POS's hand-over now routes through that same endpoint — see
// the Phase I audit note in the migration). idempotency_key
// 'order_collected:<order_id>' is the actual guard against a retried
// status update awarding points twice — enforced by the ledger's UNIQUE
// constraint inside apply_loyalty_transaction, not by a check here.
export async function earnLoyaltyForOrder(admin: any, businessId: string, order: { id: string; van_id: string; source: string | null; total: number; guest_phone: string | null; guest_email: string | null; guest_name: string | null; customer_id: string | null }) {
  const settings = await getLoyaltySettings(admin, businessId)
  if (!settings.enabled) return null
  if (!isOrderEligible(settings, order)) return null

  const { findOrCreateCrmCustomer } = await import('./identity')
  const crmCustomer = await findOrCreateCrmCustomer(admin, businessId, { phone: order.guest_phone, email: order.guest_email, displayName: order.guest_name, customerId: order.customer_id })
  if (!crmCustomer) return null // no identifiable contact info — nothing to credit

  const account = await getOrCreateLoyaltyAccount(admin, businessId, crmCustomer.id)
  const points = settings.earning_method === 'visit_stamps' ? 1 : round2(order.total * (settings.points_per_pound ?? 1))
  if (points <= 0) return null

  const { data } = await admin.rpc('apply_loyalty_transaction', {
    p_business_id: businessId, p_loyalty_account_id: account.id, p_type: 'EARN', p_points_delta: points,
    p_idempotency_key: `order_collected:${order.id}`, p_order_id: order.id, p_reason: 'Order collected', p_created_by: null,
  })
  return data?.[0] ?? null
}

// I13 — refund/cancellation reversal. Only ever reverses the exact
// amount that was earned for that order (looked up from its own EARN
// ledger row), and only once — the 'refund_reversal:<order_id>'
// idempotency key prevents a second reversal if called again (e.g. two
// partial refunds that together make up a full refund).
export async function reverseLoyaltyForOrder(admin: any, businessId: string, orderId: string, reason: string) {
  const { data: earnRow } = await admin.from('loyalty_ledger').select('*').eq('business_id', businessId).eq('idempotency_key', `order_collected:${orderId}`).maybeSingle()
  if (!earnRow || earnRow.points_delta <= 0) return null // nothing was ever earned for this order

  const { data: account } = await admin.from('loyalty_accounts').select('*').eq('id', earnRow.loyalty_account_id).maybeSingle()
  if (!account) return null
  // Never drive an account negative from a reversal alone (I13) — reverse
  // at most whatever remains of the original earn.
  const reversalAmount = Math.min(earnRow.points_delta, account.balance)
  if (reversalAmount <= 0) return null

  const { data } = await admin.rpc('apply_loyalty_transaction', {
    p_business_id: businessId, p_loyalty_account_id: account.id, p_type: 'REFUND_REVERSAL', p_points_delta: -reversalAmount,
    p_idempotency_key: `refund_reversal:${orderId}`, p_order_id: orderId, p_reason: reason, p_created_by: null,
  })
  return data?.[0] ?? null
}

// I14 — redemption. Debits the ledger, then mints a single-use voucher
// (source='loyalty_redemption') for the configured reward — redemption
// itself never modifies an order directly; the voucher is applied at
// checkout through the exact same code path a promo code or manually-
// issued voucher already uses (lib/crm/discounts.ts).
export async function redeemLoyaltyReward(admin: any, businessId: string, crmCustomerId: string, userId: string) {
  const settings = await getLoyaltySettings(admin, businessId)
  if (!settings.enabled) throw new Error('loyalty_not_enabled')
  const account = await getOrCreateLoyaltyAccount(admin, businessId, crmCustomerId)
  if (account.balance < settings.reward_threshold) throw new Error('insufficient_balance')

  const { data: txn, error } = await admin.rpc('apply_loyalty_transaction', {
    p_business_id: businessId, p_loyalty_account_id: account.id, p_type: 'REDEEM', p_points_delta: -settings.reward_threshold,
    p_idempotency_key: null, p_order_id: null, p_reason: settings.reward_description, p_created_by: userId,
  })
  if (error) throw error

  const code = `FTL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  const expiresAt = settings.expiry_days ? new Date(Date.now() + settings.expiry_days * 86400000).toISOString() : null
  const { data: voucher, error: voucherError } = await admin.from('vouchers').insert({
    business_id: businessId, code, discount_type: settings.reward_value_type, discount_value: settings.reward_value,
    source: 'loyalty_redemption', intended_customer_id: crmCustomerId, expires_at: expiresAt, created_by: userId,
  }).select().single()
  if (voucherError) throw voucherError

  return { transaction: txn?.[0], voucher }
}

export async function adjustLoyaltyBalance(admin: any, businessId: string, crmCustomerId: string, delta: number, reason: string, userId: string) {
  const account = await getOrCreateLoyaltyAccount(admin, businessId, crmCustomerId)
  const { data, error } = await admin.rpc('apply_loyalty_transaction', {
    p_business_id: businessId, p_loyalty_account_id: account.id, p_type: 'ADJUST', p_points_delta: delta,
    p_idempotency_key: null, p_order_id: null, p_reason: reason, p_created_by: userId,
  })
  if (error) throw error
  return data?.[0]
}
