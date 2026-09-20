// @ts-nocheck
// I18 — public preview-only validation for the customer-facing ordering
// page (unauthenticated, same trust model as /api/orders/guest). Never
// claims anything — the real, authoritative check happens again inside
// order creation via the same lib/crm/discounts.ts function, which also
// atomically claims the redemption. This endpoint exists purely so the
// customer sees the discount before placing the order.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { validateDiscountCode } from '@/lib/crm/discounts'
import { findOrCreateCrmCustomer } from '@/lib/crm/identity'

// Body: { business_id, van_id, channel, code, subtotal, phone?, email? }
export async function POST(req: NextRequest) {
  const { business_id, van_id, channel, code, subtotal, phone, email } = await req.json().catch(() => ({}))
  if (!business_id || !code || subtotal == null) return NextResponse.json({ valid: false, reason: 'missing_fields' }, { status: 400 })

  const admin = await createAdminClient()
  let crmCustomerId: string | null = null
  if (phone || email) {
    const customer = await findOrCreateCrmCustomer(admin, business_id, { phone, email })
    crmCustomerId = customer?.id ?? null
  }
  const result = await validateDiscountCode(admin, business_id, code, { vanId: van_id, channel: channel ?? 'guest', subtotal: Number(subtotal), crmCustomerId, isNewCustomer: false })
  return NextResponse.json(result)
}
