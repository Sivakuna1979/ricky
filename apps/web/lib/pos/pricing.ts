// @ts-nocheck
// L-B — extracted from app/api/orders/pos/route.ts unchanged (byte-for-byte
// the same computation, just shared) so the new Stripe Terminal charge
// endpoint (which must know the true total BEFORE creating a PaymentIntent,
// server-side, never trusting the till's own client-side total) can never
// drift from the exact same pricing/discount/promo logic the ordinary
// till-sale path uses. One authoritative place, two callers.
import { round2 } from '@/lib/finance/money'
import { validateDiscountCode } from '@/lib/crm/discounts'
import { findOrCreateCrmCustomer } from '@/lib/crm/identity'

export async function computePosSale(admin: any, params: {
  businessId: string
  vanId: string
  items: { menu_item_id: string; name: string; price: number; quantity: number; item_total: number }[]
  dealDiscountAmount?: number
  discountCode?: string | null
  customerName?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
}) {
  const subtotal = params.items.reduce((sum, item) => sum + item.item_total, 0)
  const dealDiscount = Math.min(params.dealDiscountAmount ?? 0, subtotal)

  let resolvedCode: any = null
  let promoDiscount = 0
  let crmCustomerForCode: any = null
  if (params.businessId && (params.customerPhone || params.customerEmail)) {
    crmCustomerForCode = await findOrCreateCrmCustomer(admin, params.businessId, { phone: params.customerPhone, email: params.customerEmail, displayName: params.customerName })
  }
  if (params.discountCode && params.businessId) {
    resolvedCode = await validateDiscountCode(admin, params.businessId, params.discountCode, {
      vanId: params.vanId, channel: 'pos', subtotal: round2(subtotal - dealDiscount), crmCustomerId: crmCustomerForCode?.id ?? null, isNewCustomer: false,
    })
    if (!resolvedCode.valid) {
      const err: any = new Error(`Code not valid: ${resolvedCode.reason}`)
      err.statusCode = 400
      throw err
    }
    promoDiscount = resolvedCode.discount_amount
  }

  const totalDiscount = round2(dealDiscount + promoDiscount)
  const total = round2(Math.max(0, subtotal - totalDiscount))

  return { subtotal, totalDiscount, total, resolvedCode, crmCustomerForCode }
}
