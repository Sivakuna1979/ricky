// @ts-nocheck
// M31 — the explicit send step. Fans out into the EXISTING `notifications`
// table (one row per targeted user) so it appears in the same
// NotificationCentre every other alert already uses — never a parallel
// inbox. `sent_at` guards against a double-send (idempotent: sending an
// already-sent announcement is a no-op, not a re-fan-out).
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveGroupContext } from '@/lib/groups/context'
import { hasGroupPermission } from '@/lib/groups/permissions'
import { logAuditEvent } from '@/lib/auditLog'

export async function POST(req: Request, { params }: { params: { groupId: string; id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'manage_group_announcements')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: announcement } = await admin.from('group_announcements').select('*').eq('id', params.id).eq('group_id', ctx.groupId).maybeSingle()
  if (!announcement) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (announcement.sent_at) return NextResponse.json({ error: 'Already sent.' }, { status: 409 })

  let businessIds: string[]
  if (announcement.target_scope === 'SELECTED') {
    const { data: targets } = await admin.from('group_announcement_targets').select('business_id').eq('announcement_id', announcement.id)
    businessIds = (targets ?? []).map((t: any) => t.business_id)
  } else {
    let query = admin.from('group_memberships').select('business_id').eq('group_id', ctx.groupId).eq('status', 'ACTIVE')
    if (announcement.target_scope === 'REGION' && announcement.region_id) query = query.eq('region_id', announcement.region_id)
    const { data: memberships } = await query
    businessIds = (memberships ?? []).map((m: any) => m.business_id)
  }
  if (!businessIds.length) return NextResponse.json({ error: 'No businesses match this announcement’s target scope.' }, { status: 409 })

  const [{ data: owners }, { data: staff }] = await Promise.all([
    admin.from('businesses').select('owner_id').in('id', businessIds),
    admin.from('staff').select('user_id').in('business_id', businessIds).eq('is_active', true),
  ])
  const userIds = new Set([...(owners ?? []).map((o: any) => o.owner_id), ...(staff ?? []).map((s: any) => s.user_id)].filter(Boolean))

  const rows = [...userIds].map((user_id) => ({
    user_id, title: `📢 ${announcement.title}`, body: announcement.body, type: 'group_announcement',
    data: { group_id: ctx.groupId, announcement_id: announcement.id },
  }))
  if (rows.length) await admin.from('notifications').insert(rows)

  await admin.from('group_announcements').update({ sent_at: new Date().toISOString() }).eq('id', announcement.id)
  await logAuditEvent(admin, { actorId: ctx.userId, action: 'group.announcement_sent', entityType: 'group_announcements', entityId: announcement.id, newValues: { recipient_count: rows.length, business_count: businessIds.length } })

  return NextResponse.json({ ok: true, recipient_count: rows.length, business_count: businessIds.length })
}
