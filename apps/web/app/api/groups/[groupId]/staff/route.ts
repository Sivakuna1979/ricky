// @ts-nocheck
// M6-M9 — group staff/roles. Only manage_group_members can invite/list.
// Inviting requires the target user to already have a FoodTaxi account
// (matched by email) — this phase does not build a separate group-staff
// signup flow, reusing the existing account system exactly as business
// staff invites already do conceptually (an email that doesn't match an
// existing account is rejected with a clear message, not silently
// creating one, since group_staff has no invite-token/pending-email
// concept — the simplest safe model for this phase).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveGroupContext } from '@/lib/groups/context'
import { hasGroupPermission, GROUP_ROLES } from '@/lib/groups/permissions'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET(req: NextRequest, { params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'manage_group_members')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  // M38 — aggregate/directory view only: name/email/role, never anything
  // beyond what a group role already needs to manage membership.
  const { data } = await admin.from('group_staff').select('id, role, region_id, is_active, created_at, users(full_name, email)').eq('group_id', ctx.groupId).order('created_at', { ascending: false })
  return NextResponse.json(data ?? [])
}

// Body: { email, role, region_id? }
export async function POST(req: NextRequest, { params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'manage_group_members')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  if (!body.email || !GROUP_ROLES.includes(body.role)) return NextResponse.json({ error: 'email and a valid role are required' }, { status: 400 })
  if (body.role === 'GROUP_OWNER') return NextResponse.json({ error: 'A group can only have one owner, set at creation.' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: targetUser } = await admin.from('users').select('id').eq('email', body.email.trim().toLowerCase()).maybeSingle()
  if (!targetUser) return NextResponse.json({ error: 'No FoodTaxi account found with that email — they need to sign up first.' }, { status: 404 })

  const { data: staffRow, error } = await admin.from('group_staff').upsert({
    group_id: ctx.groupId, user_id: targetUser.id, role: body.role, region_id: body.region_id ?? null, invited_by: ctx.userId, is_active: true, updated_at: new Date().toISOString(),
  }, { onConflict: 'group_id,user_id' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent(admin, { actorId: ctx.userId, action: 'group.staff_added', entityType: 'group_staff', entityId: staffRow.id, newValues: { role: body.role } })
  return NextResponse.json(staffRow, { status: 201 })
}
