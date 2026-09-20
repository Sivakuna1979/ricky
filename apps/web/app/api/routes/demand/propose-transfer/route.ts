// @ts-nocheck
// G26 — turn a loading-plan shortfall into a draft stock transfer,
// reusing Phase E's safe-action confirmation framework exactly as G63
// instructs ("reuse Phase E pending-action confirmation... never let an
// LLM directly execute these actions") — this is a plain UI-triggered
// proposal, not something FoodTaxi AI calls, but it uses the identical
// ai_pending_actions table and confirm endpoint so there is only one
// confirmation mechanism in the whole app, not two.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { assertVanAllowed } from '@/lib/ai/context'

const PENDING_ACTION_TTL_MINUTES = 30

// Body: { van_id, from_location_id, items: [{ stock_item_id, quantity }] }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_stock')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const { van_id, from_location_id, items } = body
  if (!van_id || !from_location_id || !items?.length) return NextResponse.json({ error: 'van_id, from_location_id and items are required' }, { status: 400 })
  try { assertVanAllowed(ctx, van_id) } catch { return NextResponse.json({ error: 'Not authorized for that van' }, { status: 403 }) }

  const admin = await createAdminClient()
  const { data: toLocation } = await admin.from('stock_locations').select('id, business_id').eq('van_id', van_id).maybeSingle()
  if (!toLocation || toLocation.business_id !== ctx.businessId) return NextResponse.json({ error: "This van doesn't have a stock location set up yet (Stock → Locations)." }, { status: 404 })
  const { data: fromLocation } = await admin.from('stock_locations').select('id, business_id').eq('id', from_location_id).maybeSingle()
  if (!fromLocation || fromLocation.business_id !== ctx.businessId) return NextResponse.json({ error: 'Source location not found' }, { status: 404 })

  const resolvedItems = []
  for (const item of items) {
    const { data: stockItem } = await admin.from('stock_items').select('id, name, unit').eq('id', item.stock_item_id).eq('business_id', ctx.businessId).maybeSingle()
    if (!stockItem) return NextResponse.json({ error: `Stock item not found` }, { status: 404 })
    resolvedItems.push({ stock_item_id: stockItem.id, name: stockItem.name, unit: stockItem.unit, quantity: item.quantity })
  }

  const { data: pending, error } = await admin.from('ai_pending_actions').insert({
    business_id: ctx.businessId, user_id: ctx.userId, action_type: 'create_stock_transfer',
    params: { van_id, from_location_id, to_location_id: toLocation.id, items: resolvedItems },
    expires_at: new Date(Date.now() + PENDING_ACTION_TTL_MINUTES * 60000).toISOString(),
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ pending_action_id: pending.id, items: resolvedItems, expires_in_minutes: PENDING_ACTION_TTL_MINUTES }, { status: 201 })
}
