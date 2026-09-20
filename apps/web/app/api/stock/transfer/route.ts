// @ts-nocheck
// Stock transfer between locations (C3) — e.g. Warehouse → Van 45. Recorded
// as a linked TRANSFER_OUT/TRANSFER_IN pair (shared reference_id), never a
// silent quantity overwrite.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_stock')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const { stock_item_id, from_location_id, to_location_id, quantity } = body
  if (!stock_item_id || !from_location_id || !to_location_id || !quantity || quantity <= 0) {
    return NextResponse.json({ error: 'stock_item_id, from_location_id, to_location_id and a positive quantity are required' }, { status: 400 })
  }
  if (from_location_id === to_location_id) return NextResponse.json({ error: 'Source and destination must differ' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: item } = await admin.from('stock_items').select('id, business_id').eq('id', stock_item_id).maybeSingle()
  if (!item || item.business_id !== ctx.businessId) return NextResponse.json({ error: 'Stock item not found' }, { status: 404 })
  const { data: locs } = await admin.from('stock_locations').select('id, business_id').in('id', [from_location_id, to_location_id])
  if ((locs ?? []).length !== 2 || locs.some((l: any) => l.business_id !== ctx.businessId)) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  const referenceId = randomUUID()
  const { error: outErr } = await admin.rpc('apply_stock_movement', {
    p_business_id: ctx.businessId, p_stock_item_id: stock_item_id, p_location_id: from_location_id,
    p_movement_type: 'TRANSFER_OUT', p_delta: -quantity, p_user_id: ctx.userId,
    p_reference_type: 'transfer', p_reference_id: referenceId,
  })
  if (outErr) return NextResponse.json({ error: outErr.message }, { status: 500 })

  const { error: inErr } = await admin.rpc('apply_stock_movement', {
    p_business_id: ctx.businessId, p_stock_item_id: stock_item_id, p_location_id: to_location_id,
    p_movement_type: 'TRANSFER_IN', p_delta: quantity, p_user_id: ctx.userId,
    p_reference_type: 'transfer', p_reference_id: referenceId,
  })
  if (inErr) return NextResponse.json({ error: inErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, reference_id: referenceId })
}
