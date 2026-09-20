// @ts-nocheck
// Menu-item → stock recipe links (C7). Entirely optional per menu item —
// no rows for a menu item simply means automatic deduction (C8) does
// nothing for it.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const menuItemId = searchParams.get('menu_item_id')
  if (!menuItemId) return NextResponse.json({ error: 'menu_item_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('menu_stock_components').select('*, stock_items(name, unit)').eq('menu_item_id', menuItemId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_menu')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const { menu_item_id, stock_item_id, quantity_per_item, unit } = body
  if (!menu_item_id || !stock_item_id || !quantity_per_item || quantity_per_item <= 0) {
    return NextResponse.json({ error: 'menu_item_id, stock_item_id and a positive quantity_per_item are required' }, { status: 400 })
  }

  const admin = await createAdminClient()
  const { data: menuItem } = await admin.from('menu_items').select('id, van_id').eq('id', menu_item_id).maybeSingle()
  const { data: van } = menuItem ? await admin.from('vans').select('business_id').eq('id', menuItem.van_id).maybeSingle() : { data: null }
  if (!menuItem || van?.business_id !== ctx.businessId) return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })

  const { data: stockItem } = await admin.from('stock_items').select('id, business_id').eq('id', stock_item_id).maybeSingle()
  if (!stockItem || stockItem.business_id !== ctx.businessId) return NextResponse.json({ error: 'Stock item not found' }, { status: 404 })

  const { data, error } = await admin.from('menu_stock_components')
    .upsert({ menu_item_id, stock_item_id, quantity_per_item, unit: unit ?? null }, { onConflict: 'menu_item_id,stock_item_id' })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_menu')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = await createAdminClient()
  await admin.from('menu_stock_components').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
