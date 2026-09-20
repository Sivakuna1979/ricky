// @ts-nocheck
// Wastage tracking (C10) — records the reason/quantity/cost and
// automatically creates the matching WASTAGE stock movement.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'

function round2(n: number) { return Math.round((n ?? 0) * 100) / 100 }

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const { data: records, error } = await supabase
    .from('wastage_records').select('*, stock_items(name, unit), stock_locations(name)')
    .eq('business_id', ctx.businessId).order('created_at', { ascending: false }).limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const weekStart = new Date(now.getTime() - 7 * 86400000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  function sumSince(from: Date) {
    return round2((records ?? []).filter((r: any) => new Date(r.created_at) >= from).reduce((s: number, r: any) => s + (r.cost ?? 0), 0))
  }

  return NextResponse.json({
    records,
    today: sumSince(todayStart),
    week: sumSince(weekStart),
    month: sumSince(monthStart),
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'record_wastage')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const { stock_item_id, location_id, quantity, reason, notes } = body
  if (!stock_item_id || !location_id || !quantity || quantity <= 0 || !reason) {
    return NextResponse.json({ error: 'stock_item_id, location_id, a positive quantity and reason are required' }, { status: 400 })
  }

  const admin = await createAdminClient()
  const { data: item } = await admin.from('stock_items').select('id, business_id, cost_price').eq('id', stock_item_id).maybeSingle()
  if (!item || item.business_id !== ctx.businessId) return NextResponse.json({ error: 'Stock item not found' }, { status: 404 })

  const cost = item.cost_price ? round2(item.cost_price * quantity) : null

  const { data: record, error } = await admin.from('wastage_records').insert({
    business_id: ctx.businessId, stock_item_id, location_id, quantity, cost, reason, notes: notes ?? null, recorded_by: ctx.userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.rpc('apply_stock_movement', {
    p_business_id: ctx.businessId, p_stock_item_id: stock_item_id, p_location_id: location_id,
    p_movement_type: 'WASTAGE', p_delta: -quantity, p_user_id: ctx.userId,
    p_reason: reason, p_reference_type: 'wastage', p_reference_id: record.id,
  })

  return NextResponse.json(record, { status: 201 })
}
