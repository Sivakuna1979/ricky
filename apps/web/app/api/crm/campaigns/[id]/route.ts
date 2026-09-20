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
  if (!ctx || !hasPermission(ctx.role, 'manage_campaigns')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: campaign } = await admin.from('campaigns').select('*').eq('id', params.id).eq('business_id', ctx.businessId).maybeSingle()
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: recipients } = await admin.from('campaign_recipients').select('status').eq('campaign_id', params.id)
  const stats: Record<string, number> = {}
  for (const r of recipients ?? []) stats[r.status] = (stats[r.status] ?? 0) + 1
  return NextResponse.json({ ...campaign, delivery_stats: stats, total_recipients: recipients?.length ?? 0 })
}

// Body: { status: 'CANCELLED' } — the only manual transition; SENDING/SENT/
// PARTIALLY_FAILED/FAILED are all set by the confirm/send route itself.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_campaigns')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: existing } = await admin.from('campaigns').select('*').eq('id', params.id).eq('business_id', ctx.businessId).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!['DRAFT', 'SCHEDULED'].includes(existing.status)) return NextResponse.json({ error: 'Only a draft or scheduled campaign can be cancelled' }, { status: 409 })

  const { status } = await req.json()
  if (status !== 'CANCELLED') return NextResponse.json({ error: "status must be 'CANCELLED'" }, { status: 400 })

  const { data: updated } = await admin.from('campaigns').update({ status: 'CANCELLED' }).eq('id', params.id).select().single()
  await logAuditEvent(admin, { actorId: ctx.userId, action: 'crm.campaign_cancelled', entityType: 'campaigns', entityId: params.id, oldValues: existing, newValues: updated })
  return NextResponse.json(updated)
}
