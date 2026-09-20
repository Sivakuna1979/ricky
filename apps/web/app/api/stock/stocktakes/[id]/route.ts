// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const { data: stocktake } = await supabase.from('stocktakes').select('*, stock_locations(name)').eq('id', params.id).maybeSingle()
  if (!stocktake || stocktake.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: items } = await supabase
    .from('stocktake_items').select('*, stock_items(name, unit)').eq('stocktake_id', params.id).order('id')

  return NextResponse.json({ ...stocktake, items })
}

// Body: { counts: [{ stock_item_id, counted_quantity }] } — enter counts,
// or omit `confirm` to just save progress. Pass confirm:true to finalise:
// creates an ADJUSTMENT movement for every item whose count differs from
// its expected quantity, then marks the stocktake completed.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'stocktake')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: stocktake } = await admin.from('stocktakes').select('*').eq('id', params.id).maybeSingle()
  if (!stocktake || stocktake.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (stocktake.status === 'completed') return NextResponse.json({ error: 'This stocktake is already completed' }, { status: 409 })

  const body = await req.json()
  const counts: { stock_item_id: string; counted_quantity: number }[] = body.counts ?? []
  for (const c of counts) {
    await admin.from('stocktake_items').update({ counted_quantity: c.counted_quantity })
      .eq('stocktake_id', params.id).eq('stock_item_id', c.stock_item_id)
  }

  if (!body.confirm) {
    return NextResponse.json({ ok: true, confirmed: false })
  }

  const { data: items } = await admin.from('stocktake_items').select('*').eq('stocktake_id', params.id)
  const differences: any[] = []
  for (const it of items ?? []) {
    if (it.counted_quantity === null || it.counted_quantity === undefined) continue
    const delta = Number(it.counted_quantity) - Number(it.expected_quantity)
    if (delta === 0) continue
    await admin.rpc('apply_stock_movement', {
      p_business_id: ctx.businessId, p_stock_item_id: it.stock_item_id, p_location_id: stocktake.location_id,
      p_movement_type: 'ADJUSTMENT', p_delta: delta, p_user_id: ctx.userId,
      p_reason: 'Stocktake', p_reference_type: 'stocktake', p_reference_id: stocktake.id,
    })
    differences.push({ stock_item_id: it.stock_item_id, expected: it.expected_quantity, counted: it.counted_quantity, delta })
  }

  await admin.from('stocktakes').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', params.id)

  await logAuditEvent(admin, {
    actorId: ctx.userId, action: 'stock.stocktake_confirmed', entityType: 'stocktake', entityId: params.id,
    newValues: { differences },
  })

  return NextResponse.json({ ok: true, confirmed: true, differences })
}
