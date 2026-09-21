// @ts-nocheck
// M10-M11 — the membership response/lifecycle route. Two distinct actor
// types call this, each independently authorised:
//   - the BUSINESS's own owner/staff (via lib/staffContext.ts, exactly
//     like every other business-side route) — actions: accept, reject, leave
//   - the GROUP's authorised staff (via resolveGroupContext) — action: remove
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { resolveGroupContext } from '@/lib/groups/context'
import { hasGroupPermission } from '@/lib/groups/permissions'
import { hasPermission } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/auditLog'

// Body: { action: 'accept' | 'reject' | 'leave' | 'remove' }
export async function PATCH(req: NextRequest, { params }: { params: { groupId: string; businessId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action } = await req.json().catch(() => ({}))
  if (!['accept', 'reject', 'leave', 'remove'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: membership } = await admin.from('group_memberships').select('*').eq('group_id', params.groupId).eq('business_id', params.businessId).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const now = new Date().toISOString()

  if (action === 'accept' || action === 'reject' || action === 'leave') {
    // Business-side action — requires the caller to own/manage this
    // SPECIFIC business (never inferred from the group side).
    const staffCtx = await getStaffContext(supabase, user.id, params.businessId)
    if (!staffCtx || !hasPermission(staffCtx.role, 'manage_business')) return NextResponse.json({ error: 'Not authorized for that business' }, { status: 403 })

    if (action === 'accept') {
      if (membership.status !== 'INVITED') return NextResponse.json({ error: `Cannot accept — this invitation is ${membership.status.toLowerCase()}.` }, { status: 409 })
      const { data: alreadyActive } = await admin.from('group_memberships').select('id').eq('business_id', params.businessId).eq('status', 'ACTIVE').maybeSingle()
      if (alreadyActive) return NextResponse.json({ error: 'This business already has an active group membership — leave it first.' }, { status: 409 })
      const { data: updated, error } = await admin.from('group_memberships').update({ status: 'ACTIVE', responded_at: now, responded_by: staffCtx.userId }).eq('id', membership.id).eq('status', 'INVITED').select().single()
      if (!updated) return NextResponse.json({ error: error?.message ?? 'Could not accept — it may have already been handled.' }, { status: 409 })
      await logAuditEvent(admin, { actorId: staffCtx.userId, action: 'group.membership_accepted', entityType: 'group_memberships', entityId: membership.id })
      return NextResponse.json(updated)
    }

    if (action === 'reject') {
      if (membership.status !== 'INVITED') return NextResponse.json({ error: `Cannot reject — this invitation is ${membership.status.toLowerCase()}.` }, { status: 409 })
      const { data: updated } = await admin.from('group_memberships').update({ status: 'REJECTED', responded_at: now, responded_by: staffCtx.userId }).eq('id', membership.id).eq('status', 'INVITED').select().single()
      await logAuditEvent(admin, { actorId: staffCtx.userId, action: 'group.membership_rejected', entityType: 'group_memberships', entityId: membership.id })
      return NextResponse.json(updated)
    }

    if (action === 'leave') {
      if (membership.status !== 'ACTIVE') return NextResponse.json({ error: 'This business is not an active group member.' }, { status: 409 })
      const { data: updated } = await admin.from('group_memberships').update({ status: 'LEFT', removed_at: now, removed_by: staffCtx.userId }).eq('id', membership.id).eq('status', 'ACTIVE').select().single()
      await logAuditEvent(admin, { actorId: staffCtx.userId, action: 'group.membership_left', entityType: 'group_memberships', entityId: membership.id })
      return NextResponse.json(updated)
    }
  }

  // action === 'remove' — group-side action.
  const groupCtx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!groupCtx || !hasGroupPermission(groupCtx.role, 'manage_group_members')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  if (!['INVITED', 'ACTIVE'].includes(membership.status)) return NextResponse.json({ error: `Cannot remove — this membership is already ${membership.status.toLowerCase()}.` }, { status: 409 })

  // M11 — removal revokes the RELATIONSHIP only. It never touches the
  // business row, vans, orders, customers, finance, documents, staff or
  // routes (no cascade exists from this table onto any of those — see the
  // migration's own comment) — this UPDATE is the entire effect.
  const { data: updated } = await admin.from('group_memberships').update({ status: 'REMOVED', removed_at: now, removed_by: groupCtx.userId }).eq('id', membership.id).in('status', ['INVITED', 'ACTIVE']).select().single()
  await logAuditEvent(admin, { actorId: groupCtx.userId, action: 'group.membership_removed', entityType: 'group_memberships', entityId: membership.id })
  return NextResponse.json(updated)
}
