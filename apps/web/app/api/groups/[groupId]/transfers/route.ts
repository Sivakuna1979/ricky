// @ts-nocheck
// M54-M59 — inter-business stock transfers: A proposes only (no stock
// moves yet). Requires manage_stock on the FROM business — a business can
// only ever propose sending its OWN stock, never pull from another
// business's.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { resolveGroupContext } from '@/lib/groups/context'

export async function GET(req: NextRequest, { params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data } = await admin.from('group_stock_transfers').select('*, from_business:businesses!group_stock_transfers_from_business_id_fkey(name), to_business:businesses!group_stock_transfers_to_business_id_fkey(name), from_item:stock_items!group_stock_transfers_from_stock_item_id_fkey(name, unit)').eq('group_id', ctx.groupId).order('created_at', { ascending: false })
  return NextResponse.json(data ?? [])
}

// Body: { from_business_id, to_business_id, from_stock_item_id, quantity, notes? }
export async function POST(req: NextRequest, { params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (!body.from_business_id || !body.to_business_id || !body.from_stock_item_id || !body.quantity) {
    return NextResponse.json({ error: 'from_business_id, to_business_id, from_stock_item_id and quantity are required' }, { status: 400 })
  }
  if (body.from_business_id === body.to_business_id) return NextResponse.json({ error: 'from and to must be different businesses' }, { status: 400 })

  const staffCtx = await getStaffContext(supabase, user.id, body.from_business_id)
  if (!staffCtx || !hasPermission(staffCtx.role, 'manage_stock')) return NextResponse.json({ error: 'Not authorized for the sending business' }, { status: 403 })

  const admin = await createAdminClient()
  const [{ data: fromMembership }, { data: toMembership }] = await Promise.all([
    admin.from('group_memberships').select('group_id').eq('business_id', body.from_business_id).eq('status', 'ACTIVE').maybeSingle(),
    admin.from('group_memberships').select('group_id').eq('business_id', body.to_business_id).eq('status', 'ACTIVE').maybeSingle(),
  ])
  if (fromMembership?.group_id !== params.groupId || toMembership?.group_id !== params.groupId) {
    return NextResponse.json({ error: 'Both businesses must be active members of this group.' }, { status: 409 })
  }

  const { data: stockItem } = await admin.from('stock_items').select('id, business_id').eq('id', body.from_stock_item_id).eq('business_id', body.from_business_id).maybeSingle()
  if (!stockItem) return NextResponse.json({ error: 'Stock item not found for the sending business.' }, { status: 404 })

  const idempotencyKey = `transfer:${body.from_business_id}:${body.to_business_id}:${body.from_stock_item_id}:${Date.now()}`
  const { data: transfer, error } = await admin.from('group_stock_transfers').insert({
    group_id: params.groupId, from_business_id: body.from_business_id, to_business_id: body.to_business_id,
    from_stock_item_id: body.from_stock_item_id, quantity: Number(body.quantity), notes: body.notes ?? null,
    proposed_by: staffCtx.userId, idempotency_key: idempotencyKey,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(transfer, { status: 201 })
}
