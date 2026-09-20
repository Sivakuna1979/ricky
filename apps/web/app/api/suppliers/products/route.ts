// @ts-nocheck
// Supplier ↔ stock item links (C12) — supplier product code, pack size,
// latest cost, preferred supplier.
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
  const supplierId = searchParams.get('supplier_id')
  const stockItemId = searchParams.get('stock_item_id')

  let query = supabase.from('supplier_products').select('*, supplier_records(supplier_name), stock_items(name, unit)').eq('business_id', ctx.businessId)
  if (supplierId) query = query.eq('supplier_id', supplierId)
  if (stockItemId) query = query.eq('stock_item_id', stockItemId)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_suppliers')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const { supplier_id, stock_item_id } = body
  if (!supplier_id || !stock_item_id) return NextResponse.json({ error: 'supplier_id and stock_item_id required' }, { status: 400 })

  const admin = await createAdminClient()
  const [{ data: supplier }, { data: item }] = await Promise.all([
    admin.from('supplier_records').select('id, business_id').eq('id', supplier_id).maybeSingle(),
    admin.from('stock_items').select('id, business_id').eq('id', stock_item_id).maybeSingle(),
  ])
  if (!supplier || supplier.business_id !== ctx.businessId) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
  if (!item || item.business_id !== ctx.businessId) return NextResponse.json({ error: 'Stock item not found' }, { status: 404 })

  const { data, error } = await admin.from('supplier_products')
    .upsert({
      business_id: ctx.businessId, supplier_id, stock_item_id,
      supplier_product_code: body.supplier_product_code ?? null,
      pack_size: body.pack_size ?? null,
      latest_cost: body.latest_cost ?? null,
      preferred: !!body.preferred,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'supplier_id,stock_item_id' })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
