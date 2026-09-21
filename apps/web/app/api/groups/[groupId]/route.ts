// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveGroupContext } from '@/lib/groups/context'
import { hasGroupPermission } from '@/lib/groups/permissions'
import { sanitizeBranding } from '@/lib/groups/branding'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET(req: NextRequest, { params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'view_group_dashboard')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: group } = await admin.from('business_groups').select('*').eq('id', ctx.groupId).maybeSingle()
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...group, my_role: ctx.role })
}

// M21 — brand update. Accessibility-safe defaults enforced server-side
// (sanitizeBranding never trusts a raw colour value straight into the DOM
// elsewhere in the app without going through this).
export async function PATCH(req: NextRequest, { params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'manage_group_brand')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const admin = await createAdminClient()
  const patch: any = { updated_at: new Date().toISOString() }
  if (body.name?.trim()) patch.name = body.name.trim()
  if (body.branding) patch.branding = sanitizeBranding(body.branding)
  if (body.status && ['ACTIVE', 'SUSPENDED', 'ARCHIVED'].includes(body.status) && hasGroupPermission(ctx.role, 'manage_group_members')) patch.status = body.status

  const { data: updated, error } = await admin.from('business_groups').update(patch).eq('id', ctx.groupId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAuditEvent(admin, { actorId: ctx.userId, action: 'group.updated', entityType: 'business_groups', entityId: ctx.groupId, newValues: patch })
  return NextResponse.json(updated)
}
