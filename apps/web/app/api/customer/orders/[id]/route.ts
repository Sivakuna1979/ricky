// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireCustomer } from '@/lib/customer/identity'

// GET /api/customer/orders/[id] — a single order's detail, for the
// account hub's order history. Ownership is checked against
// orders.customer_id, not just "the id is unguessable" (unlike the public
// /api/orders/[id] and /receipt/[id] routes) — this route additionally
// exposes guest_phone/guest_email/pickup detail, so it must not rely on
// UUID-secrecy alone (J57).
export async function GET(_req, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const admin = await createAdminClient()
  const ctx = await requireCustomer(supabase, admin)
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data: order, error } = await admin
    .from('orders')
    .select('id, order_number, status, total, subtotal, discount_amount, discount_code, payment_method, pickup_location, pickup_time, checked_in_at, created_at, customer_id, van_id, vans(name, slug), order_items(menu_item_id, name, price, quantity, item_total)')
    .eq('id', params.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!order || order.customer_id !== ctx.customer.id) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  return NextResponse.json(order)
}
