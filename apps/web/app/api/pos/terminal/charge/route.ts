// @ts-nocheck
// L-B — the server-authoritative POS-Terminal flow (L15, activated for the
// first time now Stripe Terminal is approved). Unlike the ordinary
// cash/card-label sale (app/api/orders/pos), the order is created in
// 'awaiting_payment' — invisible to the Kitchen Display and excluded from
// revenue (lib/finance/revenue.ts) — and only ever progresses to
// 'preparing' once Stripe genuinely confirms the card was charged, via
// either this route's own /confirm step or the Connect webhook, whichever
// arrives first. The till's own client-side total is NEVER trusted for the
// amount actually charged — it is recomputed here, server-side, through
// the exact same lib/pos/pricing.ts the ordinary sale path uses.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { assertVanAllowed } from '@/lib/ai/context'
import { computePosSale } from '@/lib/pos/pricing'
import { createTerminalPaymentIntent, toPence } from '@/lib/payments/stripeTerminal'
import { upsertProviderTransaction } from '@/lib/payments/transactions'
import { claimDiscountCode } from '@/lib/crm/discounts'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'use_pos')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { van_id, items, customer_name, customer_email, customer_phone, discount_code, discount_amount, served_by, pickup_stop_id } = body
  if (!van_id || !Array.isArray(items) || !items.length) return NextResponse.json({ error: 'van_id and items are required' }, { status: 400 })
  try { assertVanAllowed(ctx, van_id) } catch { return NextResponse.json({ error: 'Not authorized for that van' }, { status: 403 }) }

  const admin = await createAdminClient()
  const { data: van } = await admin.from('vans').select('id, business_id').eq('id', van_id).eq('business_id', ctx.businessId).maybeSingle()
  if (!van) return NextResponse.json({ error: 'Van not found' }, { status: 404 })

  const { data: connection } = await admin.from('payment_provider_connections').select('id, external_account_id, status').eq('business_id', ctx.businessId).eq('provider', 'STRIPE_TERMINAL').maybeSingle()
  if (!connection || connection.status !== 'CONNECTED') return NextResponse.json({ error: 'Stripe Terminal is not connected for this business.' }, { status: 409 })

  const { data: terminal } = await admin.from('payment_terminals').select('id').eq('business_id', ctx.businessId).eq('van_id', van_id).eq('provider', 'STRIPE_TERMINAL').maybeSingle()
  if (!terminal) return NextResponse.json({ error: 'No Stripe Terminal location is set up for this van yet — set one up in Integrations first.' }, { status: 409 })

  let subtotal: number, totalDiscount: number, total: number, resolvedCode: any, crmCustomerForCode: any
  try {
    ({ subtotal, totalDiscount, total, resolvedCode, crmCustomerForCode } = await computePosSale(admin, {
      businessId: ctx.businessId, vanId: van_id, items, dealDiscountAmount: discount_amount, discountCode: discount_code,
      customerName: customer_name, customerEmail: customer_email, customerPhone: customer_phone,
    }))
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'pricing_failed' }, { status: e.statusCode ?? 400 })
  }
  if (total <= 0) return NextResponse.json({ error: 'Total must be greater than £0 to charge a card.' }, { status: 400 })

  let verifiedStopId: string | null = null
  if (pickup_stop_id) {
    const { data: stop } = await admin.from('van_schedule').select('id').eq('id', pickup_stop_id).eq('van_id', van_id).maybeSingle()
    verifiedStopId = stop?.id ?? null
  }

  const now = new Date().toISOString()
  const { data: order, error: orderErr } = await admin.from('orders').insert({
    van_id, payment_method: 'card_at_van', subtotal, discount_amount: totalDiscount,
    discount_code: resolvedCode ? discount_code.trim().toUpperCase() : null, total,
    guest_name: customer_name?.trim() || 'Walk-in customer', guest_email: customer_email?.trim() || null, guest_phone: customer_phone?.trim() || null,
    notes: served_by?.trim() ? `Served by ${served_by.trim()}` : null,
    status: 'awaiting_payment', source: 'pos', order_number: '', pickup_stop_id: verifiedStopId, service_date: now.slice(0, 10),
  }).select().single()
  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 })

  const orderItems = items.map((item: any) => ({ order_id: order.id, menu_item_id: item.menu_item_id, name: item.name, price: item.price, quantity: item.quantity, item_total: item.item_total }))
  const { error: itemsErr } = await admin.from('order_items').insert(orderItems)
  if (itemsErr) {
    await admin.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
    return NextResponse.json({ error: itemsErr.message }, { status: 500 })
  }

  try {
    const intent = await createTerminalPaymentIntent(connection.external_account_id, {
      amountPence: toPence(total), orderId: order.id, businessId: ctx.businessId, vanId: van_id,
    })
    await upsertProviderTransaction(admin, {
      businessId: ctx.businessId, provider: 'STRIPE_TERMINAL', providerTransactionId: intent.id,
      status: 'PENDING', paymentMethodType: 'PROVIDER_VERIFIED_CARD', amount: total,
      orderId: order.id, vanId: van_id, connectionId: connection.id, terminalId: terminal.id,
    })

    if (resolvedCode?.valid) {
      try { await claimDiscountCode(admin, ctx.businessId, resolvedCode, order.id, crmCustomerForCode?.id ?? null) } catch (_e) {}
    }

    return NextResponse.json({ order_id: order.id, client_secret: intent.client_secret, provider_transaction_id: intent.id, total }, { status: 201 })
  } catch (e: any) {
    // Never leave a phantom awaiting_payment order behind if Stripe itself
    // could not be reached / rejected the request.
    await admin.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
    return NextResponse.json({ error: 'Could not start the card payment — nothing was charged.' }, { status: 502 })
  }
}
