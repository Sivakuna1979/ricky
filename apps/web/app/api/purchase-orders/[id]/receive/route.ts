// @ts-nocheck
// Goods receiving (C14): enter quantity received per line → stock
// increases at the chosen location → PO status recomputed
// (RECEIVED/PARTIALLY_RECEIVED). Does not touch hygiene records — the
// existing hygiene supplier-delivery checks are a separate, unrelated
// workflow (see docs/FOODTAXI-TECHNICAL-BASELINE.md); this only prompts
// linking to one, it never creates one automatically.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'

// Body: { location_id, items: [{ purchase_order_item_id, quantity_received_now }] }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_purchase_orders')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const { location_id, items } = body
  if (!location_id || !items?.length) return NextResponse.json({ error: 'location_id and items are required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: po } = await admin.from('purchase_orders').select('*').eq('id', params.id).maybeSingle()
  if (!po || po.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (po.status === 'CANCELLED' || po.status === 'RECEIVED') return NextResponse.json({ error: `Cannot receive against a ${po.status} order` }, { status: 409 })

  const { data: location } = await admin.from('stock_locations').select('id, business_id').eq('id', location_id).maybeSingle()
  if (!location || location.business_id !== ctx.businessId) return NextResponse.json({ error: 'Location not found' }, { status: 404 })

  const { data: poItems } = await admin.from('purchase_order_items').select('*').eq('purchase_order_id', params.id)
  const poItemsById = Object.fromEntries((poItems ?? []).map((i: any) => [i.id, i]))

  for (const line of items) {
    const poItem = poItemsById[line.purchase_order_item_id]
    if (!poItem || !line.quantity_received_now || line.quantity_received_now <= 0) continue

    const newReceived = Number(poItem.quantity_received) + Number(line.quantity_received_now)
    await admin.from('purchase_order_items').update({ quantity_received: newReceived }).eq('id', poItem.id)

    await admin.rpc('apply_stock_movement', {
      p_business_id: ctx.businessId, p_stock_item_id: poItem.stock_item_id, p_location_id: location_id,
      p_movement_type: 'PURCHASE', p_delta: line.quantity_received_now, p_user_id: ctx.userId,
      p_reference_type: 'purchase_order', p_reference_id: params.id,
    })

    if (poItem.unit_cost) {
      await admin.from('supplier_products')
        .update({ latest_cost: poItem.unit_cost, last_purchased_at: new Date().toISOString() })
        .eq('supplier_id', po.supplier_id).eq('stock_item_id', poItem.stock_item_id)
    }
  }

  const { data: refreshedItems } = await admin.from('purchase_order_items').select('quantity_ordered, quantity_received').eq('purchase_order_id', params.id)
  const allReceived = (refreshedItems ?? []).every((i: any) => Number(i.quantity_received) >= Number(i.quantity_ordered))
  const anyReceived = (refreshedItems ?? []).some((i: any) => Number(i.quantity_received) > 0)
  const newStatus = allReceived ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : po.status

  await admin.from('purchase_orders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', params.id)

  return NextResponse.json({ ok: true, status: newStatus })
}
