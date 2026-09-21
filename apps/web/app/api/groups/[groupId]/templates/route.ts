// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveGroupContext } from '@/lib/groups/context'
import { hasGroupPermission } from '@/lib/groups/permissions'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET(req: NextRequest, { params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data } = await admin.from('group_menu_templates').select('*').eq('group_id', ctx.groupId).order('created_at', { ascending: false })
  return NextResponse.json(data ?? [])
}

// Body: { name, policy? }
export async function POST(req: NextRequest, { params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'manage_group_templates')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  if (!body.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const policy = ['GROUP_LOCKED', 'GROUP_DEFAULT_BUSINESS_CAN_OVERRIDE', 'BUSINESS_CONTROLLED'].includes(body.policy) ? body.policy : 'GROUP_DEFAULT_BUSINESS_CAN_OVERRIDE'

  const admin = await createAdminClient()
  const { data: template, error } = await admin.from('group_menu_templates').insert({ group_id: ctx.groupId, name: body.name.trim(), policy, created_by: ctx.userId }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAuditEvent(admin, { actorId: ctx.userId, action: 'group.template_created', entityType: 'group_menu_templates', entityId: template.id })
  return NextResponse.json(template, { status: 201 })
}
