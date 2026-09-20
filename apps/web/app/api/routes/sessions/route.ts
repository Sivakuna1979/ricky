// @ts-nocheck
// Route sessions (G8, G9). Starting a session is optional — POS/ordering
// all keep working with no session at all (see lib/routes/sessions.ts).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { assertVanAllowed } from '@/lib/ai/context'
import { getSessionForDate, startRouteSession } from '@/lib/routes/sessions'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const vanId = searchParams.get('van_id')
  const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  if (!vanId) return NextResponse.json({ error: 'van_id required' }, { status: 400 })
  try { assertVanAllowed(ctx, vanId) } catch { return NextResponse.json({ error: 'Not authorized for that van' }, { status: 403 }) }

  const admin = await createAdminClient()
  const { data: van } = await admin.from('vans').select('id, business_id').eq('id', vanId).maybeSingle()
  if (!van || van.business_id !== ctx.businessId) return NextResponse.json({ error: 'Van not found' }, { status: 404 })

  const session = await getSessionForDate(admin, vanId, date)
  return NextResponse.json(session)
}

// Body: { van_id, date? }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const body = await req.json()
  const vanId = body.van_id
  const date = body.date ?? new Date().toISOString().slice(0, 10)
  if (!vanId) return NextResponse.json({ error: 'van_id required' }, { status: 400 })
  try { assertVanAllowed(ctx, vanId) } catch { return NextResponse.json({ error: 'Not authorized for that van' }, { status: 403 }) }

  const admin = await createAdminClient()
  const { data: van } = await admin.from('vans').select('id, business_id').eq('id', vanId).maybeSingle()
  if (!van || van.business_id !== ctx.businessId) return NextResponse.json({ error: 'Van not found' }, { status: 404 })

  const session = await startRouteSession(admin, ctx.businessId, vanId, date, ctx.userId)
  return NextResponse.json(session, { status: 201 })
}
