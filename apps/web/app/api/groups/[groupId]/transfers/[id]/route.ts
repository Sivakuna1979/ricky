// @ts-nocheck
// M54-M59 — B accepts -> real, auditable stock movements on BOTH sides via
// the existing, unmodified apply_stock_movement() RPC. Never a silent
// cross-business quantity edit — TRANSFER_OUT on A and TRANSFER_IN on B
// are both real rows in `stock_movements`, linked by this transfer's own
// id as the reference. Idempotent: only a PROPOSED transfer can be
// accepted/rejected/cancelled, and the atomic status transition below
// means a retried request can never double-move stock.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/auditLog'

// Body: { action: 'accept' | 'reject' | 'cancel', to_stock_item_id? }
export async function PATCH(req: NextRequest, { params }: { params: { groupId: string; id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, to_stock_item_id } = await req.json().catch(() => ({}))
  if (!['accept', 'reject', 'cancel'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: transfer } = await admin.from('group_stock_transfers').select('*').eq('id', params.id).eq('group_id', params.groupId).maybeSingle()
  if (!transfer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (transfer.status !== 'PROPOSED') return NextResponse.json({ error: `This transfer is already ${transfer.status.toLowerCase()}.` }, { status: 409 })

  if (action === 'cancel') {
    const staffCtx = await getStaffContext(supabase, user.id, transfer.from_business_id)
    if (!staffCtx || !hasPermission(staffCtx.role, 'manage_stock')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    const { data: updated } = await admin.from('group_stock_transfers').update({ status: 'CANCELLED', responded_by: staffCtx.userId, responded_at: new Date().toISOString() }).eq('id', transfer.id).eq('status', 'PROPOSED').select().single()
    return NextResponse.json(updated)
  }

  // accept/reject — requires manage_stock on the RECEIVING business only
  // (B decides whether to accept A's proposal).
  const staffCtx = await getStaffContext(supabase, user.id, transfer.to_business_id)
  if (!staffCtx || !hasPermission(staffCtx.role, 'manage_stock')) return NextResponse.json({ error: 'Not authorized for the receiving business' }, { status: 403 })

  if (action === 'reject') {
    const { data: updated } = await admin.from('group_stock_transfers').update({ status: 'REJECTED', responded_by: staffCtx.userId, responded_at: new Date().toISOString() }).eq('id', transfer.id).eq('status', 'PROPOSED').select().single()
    await logAuditEvent(admin, { actorId: staffCtx.userId, action: 'group.stock_transfer_rejected', entityType: 'group_stock_transfers', entityId: transfer.id })
    return NextResponse.json(updated)
  }

  // accept
  if (!to_stock_item_id) return NextResponse.json({ error: 'to_stock_item_id is required to accept — pick the matching stock item in your own catalogue.' }, { status: 400 })
  const { data: toItem } = await admin.from('stock_items').select('id, business_id').eq('id', to_stock_item_id).eq('business_id', transfer.to_business_id).maybeSingle()
  if (!toItem) return NextResponse.json({ error: 'That stock item was not found in the receiving business.' }, { status: 404 })

  // Atomic claim first — the actual double-execution guard, before either
  // stock movement is applied.
  const { data: claimed } = await admin.from('group_stock_transfers').update({ status: 'ACCEPTED', responded_by: staffCtx.userId, responded_at: new Date().toISOString(), to_stock_item_id }).eq('id', transfer.id).eq('status', 'PROPOSED').select().single()
  if (!claimed) return NextResponse.json({ error: 'This transfer was already handled.' }, { status: 409 })

  const [fromLocation, toLocation] = await Promise.all([
    admin.from('stock_locations').select('id').eq('business_id', transfer.from_business_id).eq('is_active', true).order('type', { ascending: true }).limit(1).maybeSingle(),
    admin.from('stock_locations').select('id').eq('business_id', transfer.to_business_id).eq('is_active', true).order('type', { ascending: true }).limit(1).maybeSingle(),
  ])
  if (!fromLocation.data || !toLocation.data) {
    await admin.from('group_stock_transfers').update({ status: 'PROPOSED', responded_by: null, responded_at: null }).eq('id', transfer.id)
    return NextResponse.json({ error: 'A stock location is missing for one of the businesses — cannot complete the transfer.' }, { status: 409 })
  }

  await admin.rpc('apply_stock_movement', {
    p_business_id: transfer.from_business_id, p_stock_item_id: transfer.from_stock_item_id, p_location_id: fromLocation.data.id,
    p_movement_type: 'TRANSFER_OUT', p_delta: -Number(transfer.quantity), p_user_id: staffCtx.userId,
    p_reference_type: 'group_stock_transfer', p_reference_id: transfer.id,
  })
  await admin.rpc('apply_stock_movement', {
    p_business_id: transfer.to_business_id, p_stock_item_id: to_stock_item_id, p_location_id: toLocation.data.id,
    p_movement_type: 'TRANSFER_IN', p_delta: Number(transfer.quantity), p_user_id: staffCtx.userId,
    p_reference_type: 'group_stock_transfer', p_reference_id: transfer.id,
  })

  const { data: completed } = await admin.from('group_stock_transfers').update({ status: 'COMPLETED', completed_at: new Date().toISOString() }).eq('id', transfer.id).select().single()
  await logAuditEvent(admin, { actorId: staffCtx.userId, action: 'group.stock_transfer_completed', entityType: 'group_stock_transfers', entityId: transfer.id, newValues: { quantity: transfer.quantity } })
  return NextResponse.json(completed)
}
