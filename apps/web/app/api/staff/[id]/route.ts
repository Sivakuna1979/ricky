// @ts-nocheck
// [id] here is the staff member's users.id (not a single staff row id) —
// one person can have several `staff` rows (one per assigned van), and
// edits/deactivation apply to the whole set. See app/api/staff/route.ts
// GET, which collapses rows by user_id for the directory view.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission, businessRoleToStaffRole, BUSINESS_ROLES } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/auditLog'

// Body: any of { role, van_ids, is_active }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_staff')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: existingRows } = await admin.from('staff').select('*').eq('business_id', ctx.businessId).eq('user_id', params.id)
  if (!existingRows?.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const oldRole = existingRows[0].role

  if (body.role) {
    if (!BUSINESS_ROLES.includes(body.role) || body.role === 'OWNER') return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    await admin.from('staff').update({ role: businessRoleToStaffRole(body.role) }).eq('business_id', ctx.businessId).eq('user_id', params.id)
  }

  if ('is_active' in body) {
    await admin.from('staff').update({ is_active: !!body.is_active }).eq('business_id', ctx.businessId).eq('user_id', params.id)
  }

  if (Array.isArray(body.van_ids)) {
    const vanIds = body.van_ids.filter(Boolean)
    if (vanIds.length) {
      const { data: vans } = await admin.from('vans').select('id, business_id').in('id', vanIds)
      if ((vans ?? []).length !== vanIds.length || vans.some((v: any) => v.business_id !== ctx.businessId)) {
        return NextResponse.json({ error: 'One or more vans do not belong to this business' }, { status: 403 })
      }
    }
    const role = body.role ? businessRoleToStaffRole(body.role) : oldRole
    const isActive = 'is_active' in body ? !!body.is_active : existingRows.some((r: any) => r.is_active)
    const invitedAt = existingRows[0].invited_at
    const joinedAt = existingRows[0].joined_at

    await admin.from('staff').delete().eq('business_id', ctx.businessId).eq('user_id', params.id)
    const rows = vanIds.length
      ? vanIds.map((vanId: string) => ({ business_id: ctx.businessId, user_id: params.id, van_id: vanId, role, is_active: isActive, invited_at: invitedAt, joined_at: joinedAt }))
      : [{ business_id: ctx.businessId, user_id: params.id, van_id: null, role, is_active: isActive, invited_at: invitedAt, joined_at: joinedAt }]
    await admin.from('staff').insert(rows)
  }

  if (body.role && body.role !== oldRole) {
    await logAuditEvent(admin, {
      actorId: ctx.userId, action: 'staff.role_change', entityType: 'staff', entityId: params.id,
      oldValues: { role: oldRole }, newValues: { role: body.role },
    })
  }

  return NextResponse.json({ ok: true })
}

// Deactivate, never hard-delete — preserves shift/timesheet history.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_staff')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: existingRows } = await admin.from('staff').select('id').eq('business_id', ctx.businessId).eq('user_id', params.id)
  if (!existingRows?.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await admin.from('staff').update({ is_active: false }).eq('business_id', ctx.businessId).eq('user_id', params.id)
  await logAuditEvent(admin, { actorId: ctx.userId, action: 'staff.deactivated', entityType: 'staff', entityId: params.id })
  return NextResponse.json({ ok: true })
}
