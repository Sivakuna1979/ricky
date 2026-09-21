// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireCustomer } from '@/lib/customer/identity'

// GET /api/customer/orders — J11 order history. Strictly scoped to
// orders.customer_id = the signed-in customer's own id — never derived
// from a guessable id, and never another customer's rows (J57).
export async function GET() {
  const supabase = await createClient()
  const admin = await createAdminClient()
  const ctx = await requireCustomer(supabase, admin)
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data: orders, error } = await admin
    .from('orders')
    .select('id, order_number, status, total, created_at, van_id, vans(name, slug), order_items(name, quantity)')
    .eq('customer_id', ctx.customer.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: orders ?? [] })
}
