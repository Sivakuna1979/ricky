// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveGroupContext } from '@/lib/groups/context'
import { hasGroupPermission } from '@/lib/groups/permissions'

export async function GET(req: NextRequest, { params }: { params: { groupId: string; id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: template } = await admin.from('group_menu_templates').select('*').eq('id', params.id).eq('group_id', ctx.groupId).maybeSingle()
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: items } = await admin.from('group_menu_template_items').select('*').eq('template_id', params.id).order('sort_order')
  const { data: versions } = await admin.from('group_menu_template_versions').select('id, version_number, published_at').eq('template_id', params.id).order('version_number', { ascending: false })
  return NextResponse.json({ ...template, items: items ?? [], versions: versions ?? [] })
}

// Body: { name?, policy?, status? }
export async function PATCH(req: NextRequest, { params }: { params: { groupId: string; id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'manage_group_templates')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const patch: any = { updated_at: new Date().toISOString() }
  if (body.name?.trim()) patch.name = body.name.trim()
  if (['GROUP_LOCKED', 'GROUP_DEFAULT_BUSINESS_CAN_OVERRIDE', 'BUSINESS_CONTROLLED'].includes(body.policy)) patch.policy = body.policy
  if (['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(body.status)) patch.status = body.status

  const admin = await createAdminClient()
  const { data: updated, error } = await admin.from('group_menu_templates').update(patch).eq('id', params.id).eq('group_id', ctx.groupId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(updated)
}
