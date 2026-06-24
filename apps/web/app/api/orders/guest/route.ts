// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'

const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SB_KEY = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

async function sbPost(table: string, body: any) {
  const res = await fetch(`${SB_URL()}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY(),
      Authorization: `Bearer ${SB_KEY()}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(Array.isArray(data) ? data[0]?.message : (data.message ?? JSON.stringify(data)))
  return Array.isArray(data) ? data[0] : data
}

export async function POST(req: NextRequest) {
  try {
    const { van_id, business_id, customer_name, customer_phone, notes, items, subtotal, total, payment_method } = await req.json()

    if (!customer_name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!customer_phone) return NextResponse.json({ error: 'Phone is required' }, { status: 400 })
    if (!items?.length) return NextResponse.json({ error: 'No items in order' }, { status: 400 })

    const order_number = 'FT' + Date.now().toString().slice(-6)

    // Try with guest columns first, fall back to notes-only
    let order: any = null
    try {
      order = await sbPost('orders', {
        van_id: van_id || null,
        guest_name: customer_name,
        guest_phone: customer_phone,
        notes: notes || null,
        subtotal: subtotal ?? 0,
        total: total ?? 0,
        payment_method: payment_method ?? 'cash_at_van',
        status: 'pending',
        order_number,
      })
    } catch {
      order = await sbPost('orders', {
        van_id: van_id || null,
        notes: `Order from ${customer_name} (${customer_phone})${notes ? '. ' + notes : ''}`,
        subtotal: subtotal ?? 0,
        total: total ?? 0,
        payment_method: payment_method ?? 'cash_at_van',
        status: 'pending',
        order_number,
      })
    }

    if (order?.id && items.length > 0) {
      await sbPost('order_items', items.map((i: any) => ({
        order_id: order.id,
        menu_item_id: i.menu_item_id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        item_total: i.item_total,
      }))).catch(() => {})
    }

    return NextResponse.json({ order_number, id: order?.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed' }, { status: 500 })
  }
}
