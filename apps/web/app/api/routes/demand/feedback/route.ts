// @ts-nocheck
// G45 — record whether a demand suggestion was used, adjusted, or
// ignored. Appends feedback columns only; never touches the original
// baseline_quantity/suggested_quantity (G44 — predictions are never
// rewritten after the fact).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'

// Body: { demand_estimate_id, status: 'used'|'adjusted'|'ignored', final_quantity? }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_stock')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  if (!body.demand_estimate_id || !['used', 'adjusted', 'ignored'].includes(body.status)) {
    return NextResponse.json({ error: 'demand_estimate_id and a valid status are required' }, { status: 400 })
  }

  const admin = await createAdminClient()
  const { data: existing } = await admin.from('demand_estimates').select('id, business_id').eq('id', body.demand_estimate_id).maybeSingle()
  if (!existing || existing.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await admin.from('demand_estimates').update({
    feedback_status: body.status,
    feedback_quantity: body.status === 'adjusted' ? body.final_quantity ?? null : null,
    feedback_at: new Date().toISOString(),
    feedback_by: ctx.userId,
  }).eq('id', body.demand_estimate_id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
