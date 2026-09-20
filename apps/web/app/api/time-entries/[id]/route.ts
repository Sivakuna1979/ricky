// @ts-nocheck
// Manual timesheet corrections (C21) — audit-logged (C29).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/auditLog'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_shifts')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: existing } = await admin.from('time_entries').select('*').eq('id', params.id).maybeSingle()
  if (!existing || existing.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  if (!body.adjustment_reason) return NextResponse.json({ error: 'adjustment_reason is required for a manual correction' }, { status: 400 })

  const update: Record<string, any> = {
    is_manual_adjustment: true, adjustment_reason: body.adjustment_reason, adjusted_by: ctx.userId, updated_at: new Date().toISOString(),
  }
  if (body.clock_in_at) update.clock_in_at = body.clock_in_at
  if (body.clock_out_at !== undefined) update.clock_out_at = body.clock_out_at

  const { data, error } = await admin.from('time_entries').update(update).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent(admin, {
    actorId: ctx.userId, action: 'time_entry.correction', entityType: 'time_entry', entityId: params.id,
    oldValues: { clock_in_at: existing.clock_in_at, clock_out_at: existing.clock_out_at },
    newValues: { clock_in_at: data.clock_in_at, clock_out_at: data.clock_out_at, reason: body.adjustment_reason },
  })

  return NextResponse.json(data)
}
