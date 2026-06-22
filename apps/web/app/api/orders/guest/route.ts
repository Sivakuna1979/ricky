// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function getAdmin() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    { cookies: { getAll: () => [], setAll: () => {} }, auth: { persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const { van_id, business_id, customer_name, customer_phone, notes, items, subtotal, total, payment_method } = await req.json()

    if (!customer_name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!customer_phone) return NextResponse.json({ error: 'Phone is required' }, { status: 400 })
    if (!items?.length) return NextResponse.json({ error: 'No items in order' }, { status: 400 })

    const db = getAdmin()

    // Generate a short order number
    const order_number = 'FT' + Date.now().toString().slice(-6)

    const { data: order, error: orderErr } = await db
      .from('orders')
      .insert({
        van_id: van_id || null,
        business_id: business_id || null,
        guest_name: customer_name,
        guest_phone: customer_phone,
        notes: notes || null,
        subtotal: subtotal ?? 0,
        total: total ?? 0,
        payment_method: payment_method ?? 'cash_at_van',
        status: 'pending',
        order_number,
      })
      .select()
      .single()

    if (orderErr) {
      // If guest_name/guest_phone columns don't exist, try without them
      const { data: order2, error: orderErr2 } = await db
        .from('orders')
        .insert({
          van_id: van_id || null,
          notes: `Order from ${customer_name} (${customer_phone})${notes ? '. ' + notes : ''}`,
          subtotal: subtotal ?? 0,
          total: total ?? 0,
          payment_method: payment_method ?? 'cash_at_van',
          status: 'pending',
          order_number,
        })
        .select()
        .single()

      if (orderErr2) return NextResponse.json({ error: orderErr2.message }, { status: 500 })

      // Insert order items
      if (order2 && items.length > 0) {
        await db.from('order_items').insert(
          items.map((i: any) => ({ order_id: order2.id, menu_item_id: i.menu_item_id, name: i.name, price: i.price, quantity: i.quantity, item_total: i.item_total }))
        ).catch(() => {})
      }

      return NextResponse.json({ order_number, id: order2?.id })
    }

    // Insert order items
    if (order && items.length > 0) {
      await db.from('order_items').insert(
        items.map((i: any) => ({ order_id: order.id, menu_item_id: i.menu_item_id, name: i.name, price: i.price, quantity: i.quantity, item_total: i.item_total }))
      ).catch(() => {})
    }

    return NextResponse.json({ order_number, id: order?.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed' }, { status: 500 })
  }
}
