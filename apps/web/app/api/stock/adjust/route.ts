// @ts-nocheck
// Manual stock adjustment (C4) — e.g. correcting a count without a full
// stocktake. Audit-logged (C29) since it directly changes recorded stock.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/auditLog'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_stock')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const { stock_item_id, location_id, new_quantity, reason } = body
  if (!stock_item_id || !location_id || new_quantity === undefined || new_quantity === null) {
    return NextResponse.json({ error: 'stock_item_id, location_id and new_quantity are required' }, { status: 400 })
  }

  const admin = await createAdminClient()
  const { data: item } = await admin.from('stock_items').select('id, business_id, name').eq('id', stock_item_id).maybeSingle()
  if (!item || item.business_id !== ctx.businessId) return NextResponse.json({ error: 'Stock item not found' }, { status: 404 })

  const { data: level } = await admin.from('stock_levels').select('quantity').eq('stock_item_id', stock_item_id).eq('location_id', location_id).maybeSingle()
  const current = level?.quantity ?? 0
  const delta = Number(new_quantity) - current
  if (delta === 0) return NextResponse.json({ ok: true, new_quantity: current })

  const { data: newQty, error } = await admin.rpc('apply_stock_movement', {
    p_business_id: ctx.businessId, p_stock_item_id: stock_item_id, p_location_id: location_id,
    p_movement_type: 'ADJUSTMENT', p_delta: delta, p_user_id: ctx.userId, p_reason: reason ?? null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent(admin, {
    actorId: ctx.userId, action: 'stock.adjust', entityType: 'stock_item', entityId: stock_item_id,
    oldValues: { quantity: current }, newValues: { quantity: newQty, reason },
  })

  return NextResponse.json({ ok: true, new_quantity: newQty })
}
