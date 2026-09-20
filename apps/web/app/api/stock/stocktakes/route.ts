// @ts-nocheck
// Stocktake (C5): select a location → snapshot expected quantities → staff
// enter actual counts (via PATCH on the created stocktake) → confirm →
// creates ADJUSTMENT movements for any difference. Counting never silently
// overwrites stock — see [id]/route.ts for the confirm step.
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

  const { data, error } = await supabase
    .from('stocktakes').select('*, stock_locations(name)').eq('business_id', ctx.businessId).order('started_at', { ascending: false }).limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'stocktake')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { location_id } = await req.json()
  if (!location_id) return NextResponse.json({ error: 'location_id required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: location } = await admin.from('stock_locations').select('id, business_id').eq('id', location_id).maybeSingle()
  if (!location || location.business_id !== ctx.businessId) return NextResponse.json({ error: 'Location not found' }, { status: 404 })

  const { data: stocktake, error } = await admin.from('stocktakes').insert({
    business_id: ctx.businessId, location_id, started_by: ctx.userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: levels } = await admin.from('stock_levels').select('stock_item_id, quantity').eq('location_id', location_id)
  if (levels?.length) {
    await admin.from('stocktake_items').insert(
      levels.map((l: any) => ({ stocktake_id: stocktake.id, stock_item_id: l.stock_item_id, expected_quantity: l.quantity }))
    )
  }

  return NextResponse.json(stocktake, { status: 201 })
}
