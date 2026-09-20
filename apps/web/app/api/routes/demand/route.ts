// @ts-nocheck
// Demand planning / loading plan (G21–G25). GET only — this never writes
// stock or purchase orders itself; see propose-transfer for the
// confirmation-gated action.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { assertVanAllowed } from '@/lib/ai/context'
import { getLoadingPlan } from '@/lib/routes/demand'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_stock')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const vanId = searchParams.get('van_id')
  const stopId = searchParams.get('stop_id')
  const targetDate = searchParams.get('date')
  const bufferPct = Number(searchParams.get('buffer_pct') ?? 10)
  if (!vanId || !stopId || !targetDate) return NextResponse.json({ error: 'van_id, stop_id and date are required' }, { status: 400 })
  try { assertVanAllowed(ctx, vanId) } catch { return NextResponse.json({ error: 'Not authorized for that van' }, { status: 403 }) }

  const admin = await createAdminClient()
  const { data: stop } = await admin.from('van_schedule').select('id, van_id').eq('id', stopId).maybeSingle()
  if (!stop || stop.van_id !== vanId) return NextResponse.json({ error: 'Stop not found for this van' }, { status: 404 })

  const plan = await getLoadingPlan(admin, ctx.businessId, vanId, stopId, targetDate, bufferPct)
  return NextResponse.json(plan)
}
