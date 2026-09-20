// @ts-nocheck
// Stock catalogue (C1, C2, C6). Businesses create their own catalogue —
// nothing here is hard-coded. GET supports the filters C1 asks for
// (van/location/category/supplier/low_stock/out_of_stock); quantities are
// summed from stock_levels per item since quantity lives per-location.
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
  const category = searchParams.get('category')
  const supplierId = searchParams.get('supplier_id')
  const locationId = searchParams.get('location_id')
  const vanId = searchParams.get('van_id')
  const lowStockOnly = searchParams.get('low_stock') === '1'
  const outOfStockOnly = searchParams.get('out_of_stock') === '1'

  let query = supabase.from('stock_items').select('*').eq('business_id', ctx.businessId).eq('active', true).order('name')
  if (category) query = query.eq('category', category)
  if (supplierId) query = query.eq('supplier_id', supplierId)
  const { data: items, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const itemIds = (items ?? []).map((i: any) => i.id)
  let levelsQuery = supabase.from('stock_levels').select('stock_item_id, location_id, quantity').in('stock_item_id', itemIds.length ? itemIds : ['00000000-0000-0000-0000-000000000000'])
  if (locationId) levelsQuery = levelsQuery.eq('location_id', locationId)
  if (vanId) {
    const { data: loc } = await supabase.from('stock_locations').select('id').eq('van_id', vanId).maybeSingle()
    levelsQuery = levelsQuery.eq('location_id', loc?.id ?? '00000000-0000-0000-0000-000000000000')
  }
  const { data: levels } = await levelsQuery

  const totalsByItem: Record<string, number> = {}
  const byLocationByItem: Record<string, { location_id: string; quantity: number }[]> = {}
  for (const l of levels ?? []) {
    totalsByItem[l.stock_item_id] = (totalsByItem[l.stock_item_id] ?? 0) + (l.quantity ?? 0)
    ;(byLocationByItem[l.stock_item_id] ??= []).push({ location_id: l.location_id, quantity: l.quantity })
  }

  let result = (items ?? []).map((i: any) => ({
    ...i,
    current_quantity: totalsByItem[i.id] ?? 0,
    by_location: byLocationByItem[i.id] ?? [],
  }))

  if (locationId || vanId) {
    // When filtering to one location, only show items actually stocked there.
    result = result.filter((i: any) => (i.by_location ?? []).length > 0)
  }
  if (outOfStockOnly) result = result.filter((i: any) => i.current_quantity <= 0)
  else if (lowStockOnly) result = result.filter((i: any) => i.current_quantity > 0 && i.current_quantity <= i.minimum_quantity)

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_stock')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const admin = await createAdminClient()
  const { data, error } = await admin.from('stock_items').insert({
    business_id: ctx.businessId,
    name: body.name,
    category: body.category ?? null,
    sku: body.sku ?? null,
    barcode: body.barcode ?? null,
    unit: body.unit ?? 'each',
    pack_size: body.pack_size ?? null,
    minimum_quantity: body.minimum_quantity ?? 0,
    reorder_quantity: body.reorder_quantity ?? null,
    cost_price: body.cost_price ?? null,
    supplier_id: body.supplier_id ?? null,
    expiry_tracking: !!body.expiry_tracking,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
