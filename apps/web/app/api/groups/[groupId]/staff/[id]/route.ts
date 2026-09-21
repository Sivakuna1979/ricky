// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveGroupContext } from '@/lib/groups/context'
import { hasGroupPermission, GROUP_ROLES } from '@/lib/groups/permissions'
import { logAuditEvent } from '@/lib/auditLog'

// Body: { role?, region_id?, is_active? }
export async function PATCH(req: NextRequest, { params }: { params: { groupId: string; id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'manage_group_members')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: row } = await admin.from('group_staff').select('id, group_id, role').eq('id', params.id).maybeSingle()
  if (!row || row.group_id !== ctx.groupId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (row.role === 'GROUP_OWNER') return NextResponse.json({ error: 'The group owner cannot be changed here.' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const patch: any = { updated_at: new Date().toISOString() }
  if (body.role && GROUP_ROLES.includes(body.role) && body.role !== 'GROUP_OWNER') patch.role = body.role
  if ('region_id' in body) patch.region_id = body.region_id ?? null
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active

  const { data: updated, error } = await admin.from('group_staff').update(patch).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAuditEvent(admin, { actorId: ctx.userId, action: 'group.staff_updated', entityType: 'group_staff', entityId: params.id, newValues: patch })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { groupId: string; id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'manage_group_members')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: row } = await admin.from('group_staff').select('id, group_id, role').eq('id', params.id).maybeSingle()
  if (!row || row.group_id !== ctx.groupId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (row.role === 'GROUP_OWNER') return NextResponse.json({ error: 'The group owner cannot be removed.' }, { status: 400 })

  await admin.from('group_staff').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', params.id)
  await logAuditEvent(admin, { actorId: ctx.userId, action: 'group.staff_removed', entityType: 'group_staff', entityId: params.id })
  return NextResponse.json({ ok: true })
}
