// @ts-nocheck
// H57 — optional period locking. Locking/unlocking is its own authorised,
// audited action; nothing else in Phase H checks a lock automatically yet
// (no write route currently refuses to touch a locked period's date) —
// documented as a foundation, not full enforcement (see docs "Not built").
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_finance_summary')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data } = await admin.from('finance_periods').select('*').eq('business_id', ctx.businessId).order('period_start', { ascending: false })
  return NextResponse.json(data ?? [])
}

// Body: { period_start, period_end, locked, notes? }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_finance_settings')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const { period_start, period_end, locked, notes } = body
  if (!period_start || !period_end) return NextResponse.json({ error: 'period_start and period_end are required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: saved, error } = await admin.from('finance_periods').upsert({
    business_id: ctx.businessId, period_start, period_end, locked: !!locked,
    locked_by: locked ? ctx.userId : null, locked_at: locked ? new Date().toISOString() : null, notes: notes ?? null,
  }, { onConflict: 'business_id,period_start,period_end' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent(admin, { actorId: ctx.userId, action: locked ? 'finance.period_locked' : 'finance.period_unlocked', entityType: 'finance_periods', entityId: saved.id, newValues: saved })
  return NextResponse.json(saved)
}
