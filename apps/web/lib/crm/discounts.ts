// @ts-nocheck
// I20–I23 — the ONE place a discount code (promo or voucher) is ever
// validated and priced. Used identically by POS, guest/online and
// WhatsApp order creation — never trusts a client-calculated discount
// value (I18/I21). A code is tried as a promo code first, then as a
// voucher; only one discount code is ever applied per order (I22 — no
// stacking).
//
// Two-step flow: validateDiscountCode() is a read-only check + price
// calculation, used both for a pre-order preview and right before the
// order insert. claimDiscountCode() is called AFTER the order row exists
// (it needs a real order_id) and does the actual atomic claim via the
// migration's redeem_promo_code()/redeem_voucher() RPCs. In the rare case
// a limited-redemption code is exhausted by a concurrent order between
// validate and claim, the order still stands with its already-applied
// discount (it was already priced and placed) — the claim's real job is
// reliable redemption *counting*, not blocking an order that already
// happened; documented as an accepted, low-risk simplification for this
// scale (I20 — "do not over-engineer").
import { round2 } from '@/lib/finance/money'

function computeDiscount(subtotal: number, type: string, value: number): number {
  const raw = type === 'percentage' ? subtotal * (value / 100) : value
  return round2(Math.max(0, Math.min(raw, subtotal))) // never below £0, never more than the order itself (I21)
}

export async function validateDiscountCode(admin: any, businessId: string, code: string, ctx: {
  vanId: string; channel: string; subtotal: number; crmCustomerId: string | null; isNewCustomer: boolean
}) {
  const upper = code.trim().toUpperCase()
  if (!upper) return { valid: false, reason: 'no_code' }

  const { data: promo } = await admin.from('promo_codes').select('*').eq('business_id', businessId).eq('code', upper).maybeSingle()
  if (promo) {
    if (!promo.is_active) return { valid: false, reason: 'inactive' }
    const now = new Date()
    if (promo.starts_at && new Date(promo.starts_at) > now) return { valid: false, reason: 'not_started' }
    if (promo.ends_at && new Date(promo.ends_at) < now) return { valid: false, reason: 'expired' }
    if (ctx.subtotal < (promo.min_spend ?? 0)) return { valid: false, reason: 'below_minimum_spend', min_spend: promo.min_spend }
    if (promo.eligible_van_ids?.length && !promo.eligible_van_ids.includes(ctx.vanId)) return { valid: false, reason: 'wrong_van' }
    if (promo.eligible_channels?.length && !promo.eligible_channels.includes(ctx.channel)) return { valid: false, reason: 'wrong_channel' }
    if (promo.new_customers_only && !ctx.isNewCustomer) return { valid: false, reason: 'new_customers_only' }
    if (promo.max_redemptions != null) {
      const { count } = await admin.from('promo_redemptions').select('id', { count: 'exact', head: true }).eq('promo_code_id', promo.id)
      if ((count ?? 0) >= promo.max_redemptions) return { valid: false, reason: 'redemption_limit_reached' }
    }
    if (ctx.crmCustomerId && promo.per_customer_limit != null) {
      const { count } = await admin.from('promo_redemptions').select('id', { count: 'exact', head: true }).eq('promo_code_id', promo.id).eq('crm_customer_id', ctx.crmCustomerId)
      if ((count ?? 0) >= promo.per_customer_limit) return { valid: false, reason: 'per_customer_limit_reached' }
    }
    const discountAmount = computeDiscount(ctx.subtotal, promo.discount_type, promo.discount_value)
    return { valid: true, kind: 'promo', id: promo.id, discount_amount: discountAmount, description: promo.description }
  }

  const { data: voucher } = await admin.from('vouchers').select('*').eq('business_id', businessId).eq('code', upper).maybeSingle()
  if (voucher) {
    if (voucher.status !== 'ACTIVE') return { valid: false, reason: 'not_active' }
    if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) return { valid: false, reason: 'expired' }
    if (voucher.intended_customer_id && voucher.intended_customer_id !== ctx.crmCustomerId) return { valid: false, reason: 'not_your_voucher' }
    const discountAmount = computeDiscount(ctx.subtotal, voucher.discount_type, voucher.discount_value)
    return { valid: true, kind: 'voucher', id: voucher.id, discount_amount: discountAmount, description: 'Voucher' }
  }

  return { valid: false, reason: 'not_found' }
}

export async function claimDiscountCode(admin: any, businessId: string, resolved: { kind: string; id: string; discount_amount: number }, orderId: string, crmCustomerId: string | null) {
  if (resolved.kind === 'promo') {
    const { data } = await admin.rpc('redeem_promo_code', {
      p_business_id: businessId, p_promo_code_id: resolved.id, p_order_id: orderId, p_crm_customer_id: crmCustomerId, p_discount_amount: resolved.discount_amount,
    })
    return data?.[0]
  }
  const { data } = await admin.rpc('redeem_voucher', { p_business_id: businessId, p_voucher_id: resolved.id, p_order_id: orderId, p_crm_customer_id: crmCustomerId })
  return data?.[0]
}
