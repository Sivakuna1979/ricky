// @ts-nocheck
// Stock movement history (C4) — read-only; every write happens via
// apply_stock_movement() called from the specific-purpose routes (adjust,
// transfer, receive, wastage, order deduction/restoration).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const stockItemId = searchParams.get('stock_item_id')
  const locationId = searchParams.get('location_id')
  const movementType = searchParams.get('movement_type')
  const limit = Math.min(Number(searchParams.get('limit') ?? 100), 500)

  let query = supabase
    .from('stock_movements')
    .select('*, stock_items(name, unit), stock_locations(name)')
    .eq('business_id', ctx.businessId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (stockItemId) query = query.eq('stock_item_id', stockItemId)
  if (locationId) query = query.eq('location_id', locationId)
  if (movementType) query = query.eq('movement_type', movementType)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
