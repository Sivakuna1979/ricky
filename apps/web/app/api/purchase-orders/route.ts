// @ts-nocheck
// Purchase orders (C13) — deliberately simple: DRAFT → ORDERED →
// PARTIALLY_RECEIVED/RECEIVED, or CANCELLED. No procurement approval
// chains or budget workflows.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  let query = supabase.from('purchase_orders').select('*, supplier_records(supplier_name), purchase_order_items(id, quantity_ordered, quantity_received)').eq('business_id', ctx.businessId).order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Body: { supplier_id, expected_date?, notes?, items: [{ stock_item_id, quantity_ordered, unit_cost? }] }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_purchase_orders')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const { supplier_id, expected_date, notes, items } = body
  if (!supplier_id || !items?.length) return NextResponse.json({ error: 'supplier_id and at least one item are required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: supplier } = await admin.from('supplier_records').select('id, business_id').eq('id', supplier_id).maybeSingle()
  if (!supplier || supplier.business_id !== ctx.businessId) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })

  const { data: po, error } = await admin.from('purchase_orders').insert({
    business_id: ctx.businessId, supplier_id, expected_date: expected_date ?? null, notes: notes ?? null, ordered_by: ctx.userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { error: itemsErr } = await admin.from('purchase_order_items').insert(
    items.map((i: any) => ({ purchase_order_id: po.id, stock_item_id: i.stock_item_id, quantity_ordered: i.quantity_ordered, unit_cost: i.unit_cost ?? null }))
  )
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })

  return NextResponse.json(po, { status: 201 })
}
