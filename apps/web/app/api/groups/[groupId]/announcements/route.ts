// @ts-nocheck
// M31-M35 — internal group announcements. Kept entirely separate from
// customer marketing (Phase I campaigns) — staff-facing only. Creating a
// draft here sends NOTHING — see /announcements/[id]/send for the
// explicit send step.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveGroupContext } from '@/lib/groups/context'
import { hasGroupPermission } from '@/lib/groups/permissions'

export async function GET(req: NextRequest, { params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data } = await admin.from('group_announcements').select('*').eq('group_id', ctx.groupId).order('created_at', { ascending: false })
  return NextResponse.json(data ?? [])
}

// Body: { title, body, target_scope?, region_id?, business_ids? }
export async function POST(req: NextRequest, { params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'manage_group_announcements')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  if (!body.title?.trim() || !body.body?.trim()) return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
  const targetScope = ['ALL', 'REGION', 'SELECTED'].includes(body.target_scope) ? body.target_scope : 'ALL'

  const admin = await createAdminClient()
  const { data: announcement, error } = await admin.from('group_announcements').insert({
    group_id: ctx.groupId, title: body.title.trim(), body: body.body.trim(),
    target_scope: targetScope, region_id: targetScope === 'REGION' ? (body.region_id ?? null) : null, created_by: ctx.userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (targetScope === 'SELECTED' && Array.isArray(body.business_ids) && body.business_ids.length) {
    await admin.from('group_announcement_targets').insert(body.business_ids.map((business_id: string) => ({ announcement_id: announcement.id, business_id })))
  }

  return NextResponse.json(announcement, { status: 201 })
}
