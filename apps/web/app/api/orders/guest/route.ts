// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'

const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON_KEY = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SERVICE_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

async function sbPostWith(key: string, table: string, body: any) {
  const res = await fetch(`${SB_URL()}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err: any = new Error(Array.isArray(data) ? data[0]?.message : (data.message ?? JSON.stringify(data)))
    err.status = res.status
    throw err
  }
  return Array.isArray(data) ? data[0] : data
}

// Try the service key first (bypasses RLS); if it's missing or invalid,
// fall back to the anon key (works via the orders_guest_insert policy).
async function sbPost(table: string, body: any) {
  const svc = SERVICE_KEY()
  if (svc && svc !== ANON_KEY()) {
    try {
      return await sbPostWith(svc, table, body)
    } catch (e: any) {
      if (e.status !== 401 && e.status !== 403) throw e
    }
  }
  return sbPostWith(ANON_KEY(), table, body)
}

export async function POST(req: NextRequest) {
  try {
    const { van_id, business_id, customer_name, customer_phone, notes, pickup_location, pickup_time, items, subtotal, total, payment_method } = await req.json()

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
        pickup_location: pickup_location || null,
        pickup_time: pickup_time || null,
        subtotal: subtotal ?? 0,
        total: total ?? 0,
        payment_method: payment_method ?? 'cash_at_van',
        status: 'pending',
        order_number,
      })
    } catch {
      const pickupStr = pickup_location ? ` | Pickup: ${pickup_location}${pickup_time ? ` ~${pickup_time}` : ''}` : ''
      order = await sbPost('orders', {
        van_id: van_id || null,
        notes: `Order from ${customer_name} (${customer_phone})${notes ? '. ' + notes : ''}${pickupStr}`,
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
