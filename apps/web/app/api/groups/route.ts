// @ts-nocheck
// M76 — group onboarding: create group -> brand -> invite businesses ->
// staff -> permissions -> optional templates -> dashboard (resumable,
// since each of those steps is its own separate API call/page, not one
// monolithic wizard transaction). This route is just step 1: creating the
// group entity itself, with the creator recorded as GROUP_OWNER via both
// `business_groups.owner_user_id` and an explicit `group_staff` row (the
// same "owner AND explicit staff row" pattern documented in
// lib/groups/context.ts).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/auditLog'

// GET — every group the caller owns or has a group_staff role in.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  if (!userData?.id) return NextResponse.json([])

  const [owned, staffed] = await Promise.all([
    supabase.from('business_groups').select('id, name, slug, type, status').eq('owner_user_id', userData.id),
    supabase.from('group_staff').select('role, business_groups(id, name, slug, type, status)').eq('user_id', userData.id).eq('is_active', true),
  ])
  const groups = [
    ...(owned.data ?? []).map((g: any) => ({ ...g, my_role: 'GROUP_OWNER' })),
    ...(staffed.data ?? []).filter((s: any) => s.business_groups).map((s: any) => ({ ...s.business_groups, my_role: s.role })),
  ]
  // De-dupe (an owner also has an explicit group_staff row by convention).
  const byId = new Map(groups.map((g: any) => [g.id, g]))
  return NextResponse.json([...byId.values()])
}

// POST — create a new group. Any authenticated business owner may create
// one (M76: "reuse normal creation/onboarding rules unless separately
// approved" — creating a GROUP is not creating a new BUSINESS, so no
// subscription/billing implication at all, matching M46's explicit "do
// not create group/franchise tiers").
// Body: { name, type? }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  if (!userData?.id) return NextResponse.json({ error: 'No profile found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  if (!body.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const type = ['FRANCHISE', 'BUSINESS_GROUP', 'REGIONAL_GROUP', 'OTHER'].includes(body.type) ? body.type : 'BUSINESS_GROUP'

  const admin = await createAdminClient()
  const slugBase = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const { data: dupe } = await admin.from('business_groups').select('id').eq('slug', slugBase).maybeSingle()
  const slug = dupe ? `${slugBase}-${Date.now().toString(36)}` : slugBase

  const { data: group, error } = await admin.from('business_groups').insert({
    name: body.name.trim(), slug, type, owner_user_id: userData.id,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('group_staff').insert({ group_id: group.id, user_id: userData.id, role: 'GROUP_OWNER', invited_by: userData.id })
  await logAuditEvent(admin, { actorId: userData.id, action: 'group.created', entityType: 'business_groups', entityId: group.id, newValues: { name: group.name, type } })

  return NextResponse.json(group, { status: 201 })
}
