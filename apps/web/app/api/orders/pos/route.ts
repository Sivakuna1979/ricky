// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { round2 } from '@/lib/finance/money'
import { validateDiscountCode, claimDiscountCode } from '@/lib/crm/discounts'
import { findOrCreateCrmCustomer } from '@/lib/crm/identity'

// POST /api/orders/pos — staff-side till: rings up a face-to-face sale into
// the same `orders` table online/guest/WhatsApp orders use, tagged
// source: 'pos'. Payment happens up front, but the food still needs to be
// made and handed over — the order starts 'preparing' (shows on the
// Kitchen Display) and is only marked 'collected' once it's actually
// handed to the customer (see the POS "Ready for Pickup" panel).
const posOrderSchema = z.object({
  van_id: z.string().uuid(),
  payment_method: z.enum(['cash_at_van', 'card_at_van']),
  customer_name: z.string().optional(),
  customer_email: z.string().email().optional().or(z.literal('')),
  served_by: z.string().optional(),
  cash_tendered: z.number().optional(),
  discount_amount: z.number().min(0).optional(),
  // Phase G — the current stop, if the till has an active route session
  // going (see components/routes/CurrentStopBanner). Optional: a business
  // that hasn't started using route sessions yet sells exactly as before.
  pickup_stop_id: z.string().uuid().optional(),
  // Phase I — a promo code or voucher code, entered at the till (I18/I21:
  // always revalidated and priced server-side, never trusted from the
  // client's own discount_amount).
  discount_code: z.string().optional(),
  customer_phone: z.string().optional(),
  items: z.array(z.object({
    menu_item_id: z.string().uuid(),
    name: z.string(),
    price: z.number(),
    quantity: z.number().int().positive(),
    item_total: z.number(),
  })).min(1),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const parsed = posOrderSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { van_id, payment_method, customer_name, customer_email, customer_phone, served_by, cash_tendered, discount_amount, items, pickup_stop_id, discount_code } = parsed.data

  // Confirm this van belongs to the signed-in staff/owner before selling
  // against it — RLS enforces this too, but a clear 403 beats a cryptic
  // policy-violation error.
  const { data: myVans } = await supabase.rpc('my_van_ids')
  const allowedVanIds = (myVans ?? []).map((v: any) => (typeof v === 'string' ? v : v.my_van_ids ?? v.id))
  if (!allowedVanIds.includes(van_id)) {
    return NextResponse.json({ error: 'Not your van' }, { status: 403 })
  }

  // Never trust a stop id without checking it actually belongs to this
  // van's own schedule (G7's "resolve to an authorised actual stop"
  // principle applied here too).
  let verifiedStopId: string | null = null
  if (pickup_stop_id) {
    const { data: stop } = await supabase.from('van_schedule').select('id').eq('id', pickup_stop_id).eq('van_id', van_id).maybeSingle()
    verifiedStopId = stop?.id ?? null
  }

  const admin = await createAdminClient()
  const { data: van } = await admin.from('vans').select('business_id').eq('id', van_id).maybeSingle()
  const businessId = van?.business_id

  const subtotal = items.reduce((sum, item) => sum + item.item_total, 0)
  const dealDiscount = Math.min(discount_amount ?? 0, subtotal)

  // I18/I21 — a promo/voucher code is always revalidated and priced
  // here, server-side; the deal discount above (pre-existing, Phase B)
  // is untouched and can combine with it (I22 — deals and a code stack,
  // two codes never do).
  let resolvedCode: any = null
  let promoDiscount = 0
  let crmCustomerForCode: any = null
  if (businessId && (customer_phone || customer_email)) {
    crmCustomerForCode = await findOrCreateCrmCustomer(admin, businessId, { phone: customer_phone, email: customer_email, displayName: customer_name })
  }
  if (discount_code && businessId) {
    resolvedCode = await validateDiscountCode(admin, businessId, discount_code, {
      vanId: van_id, channel: 'pos', subtotal: round2(subtotal - dealDiscount), crmCustomerId: crmCustomerForCode?.id ?? null, isNewCustomer: false,
    })
    if (!resolvedCode.valid) return NextResponse.json({ error: `Code not valid: ${resolvedCode.reason}` }, { status: 400 })
    promoDiscount = resolvedCode.discount_amount
  }

  const totalDiscount = round2(dealDiscount + promoDiscount)
  const total = round2(Math.max(0, subtotal - totalDiscount))

  const now = new Date().toISOString()
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      van_id,
      payment_method,
      subtotal,
      discount_amount: totalDiscount,
      discount_code: resolvedCode ? discount_code!.trim().toUpperCase() : null,
      total,
      guest_name: customer_name?.trim() || 'Walk-in customer',
      guest_email: customer_email?.trim() || null,
      guest_phone: customer_phone?.trim() || null,
      notes: served_by?.trim() ? `Served by ${served_by.trim()}` : null,
      cash_tendered: payment_method === 'cash_at_van' ? cash_tendered ?? null : null,
      status: 'preparing',
      accepted_at: now,
      source: 'pos',
      order_number: '', // auto-generated by trigger
      pickup_stop_id: verifiedStopId,
      service_date: now.slice(0, 10),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (resolvedCode?.valid && businessId) {
    try { await claimDiscountCode(admin, businessId, resolvedCode, order.id, crmCustomerForCode?.id ?? null) } catch (_e) {}
  }

  const orderItems = items.map(item => ({
    order_id: order.id,
    menu_item_id: item.menu_item_id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    item_total: item.item_total,
  }))
  const { error: itemsErr } = await supabase.from('order_items').insert(orderItems)
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })

  return NextResponse.json(order, { status: 201 })
}
