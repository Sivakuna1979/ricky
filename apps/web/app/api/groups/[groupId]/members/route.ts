// @ts-nocheck
// M2/M10 — explicit Group<->Business membership. POST here only ever
// creates an INVITED row against an EXISTING business selected by its
// real id (never a name/brand match — see the claim-flow precedent in
// the Phase M migration header) — it can never itself make a membership
// ACTIVE. Only the target business's own owner/staff, via the accept
// action on /members/[businessId], can do that (M10: no silent
// membership).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveGroupContext, scopedBusinessIds } from '@/lib/groups/context'
import { hasGroupPermission } from '@/lib/groups/permissions'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET(req: NextRequest, { params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'view_group_businesses')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const businessIds = await scopedBusinessIds(supabase, ctx)
  let query = admin.from('group_memberships').select('*, businesses(id, name, city, postcode, status)').eq('group_id', ctx.groupId)
  // A regional manager only ever sees their own region's memberships,
  // including pending invites already assigned to that region.
  if (ctx.role === 'REGIONAL_MANAGER' && ctx.regionId) query = query.eq('region_id', ctx.regionId)
  const { data } = await query.order('invited_at', { ascending: false })
  return NextResponse.json(data ?? [])
}

// Body: { business_id, region_id?, reference? }
export async function POST(req: NextRequest, { params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'manage_group_members')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  if (!body.business_id) return NextResponse.json({ error: 'business_id is required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: business } = await admin.from('businesses').select('id, name').eq('id', body.business_id).maybeSingle()
  if (!business) return NextResponse.json({ error: 'No business found with that id' }, { status: 404 })

  const { data: existingActive } = await admin.from('group_memberships').select('id, group_id').eq('business_id', body.business_id).eq('status', 'ACTIVE').maybeSingle()
  if (existingActive) return NextResponse.json({ error: existingActive.group_id === ctx.groupId ? 'This business is already an active member.' : 'This business already belongs to a different group.' }, { status: 409 })

  const { data: membership, error } = await admin.from('group_memberships').insert({
    group_id: ctx.groupId, business_id: body.business_id, status: 'INVITED',
    region_id: body.region_id ?? null, reference: body.reference ?? null,
    invited_by: ctx.userId,
  }).select().single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'An invitation already exists for this business in this group.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAuditEvent(admin, { actorId: ctx.userId, action: 'group.member_invited', entityType: 'group_memberships', entityId: membership.id, newValues: { group_id: ctx.groupId, business_id: body.business_id } })
  return NextResponse.json(membership, { status: 201 })
}
