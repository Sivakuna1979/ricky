// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireCustomer } from '@/lib/customer/identity'

// GET /api/customer/orders/[id]/reorder — J12. Never places an order —
// this only tells the client what the van page needs to know to safely
// pre-fill a cart: which items are still available and at what CURRENT
// price. The van page (which independently loads the live menu) is the
// only thing that actually adds items to the cart, and only for items it
// already found in its own live menu fetch — this endpoint's job is
// purely to compute the diff to show the customer before they confirm.
export async function GET(_req, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const admin = await createAdminClient()
  const ctx = await requireCustomer(supabase, admin)
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data: order } = await admin
    .from('orders')
    .select('id, van_id, customer_id, order_items(menu_item_id, name, price, quantity)')
    .eq('id', params.id)
    .maybeSingle()
  if (!order || order.customer_id !== ctx.customer.id) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const { data: van } = await admin.from('vans').select('id, slug, name, accepts_online_orders, is_active').eq('id', order.van_id).maybeSingle()
  if (!van || !van.is_active) {
    return NextResponse.json({ van: null, vanAvailable: false, items: [] })
  }

  const itemIds = [...new Set((order.order_items ?? []).map((i: any) => i.menu_item_id).filter(Boolean))]
  let currentItems: any[] = []
  if (itemIds.length) {
    const { data } = await admin.from('menu_items').select('id, name, price, available').in('id', itemIds)
    currentItems = data ?? []
  }
  const byId = Object.fromEntries(currentItems.map((i) => [i.id, i]))

  const items = (order.order_items ?? []).map((oi: any) => {
    const cur = oi.menu_item_id ? byId[oi.menu_item_id] : null
    return {
      menu_item_id: oi.menu_item_id,
      name: oi.name,
      quantity: oi.quantity,
      original_price: oi.price,
      current_price: cur?.price ?? null,
      available: !!cur && cur.available !== false,
      removed: !cur,
      price_changed: !!cur && Number(cur.price) !== Number(oi.price),
    }
  })

  return NextResponse.json({
    vanAvailable: !!van.accepts_online_orders,
    van: { id: van.id, slug: van.slug, name: van.name },
    items,
  })
}
