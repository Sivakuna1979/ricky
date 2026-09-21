// @ts-nocheck
// M90 — resolves "who is this caller, in which group, with what role and
// region scope" — the group-layer equivalent of lib/staffContext.ts's
// getStaffContext(), following the identical pattern (never trusts a
// group_id from the request; always derived from the authenticated
// session's own group_staff row).
import { hasGroupPermission, type GroupPermission, type GroupRole } from './permissions'

export type GroupContext = {
  userId: string
  groupId: string
  groupName: string
  role: GroupRole
  regionId: string | null // null = unrestricted within the group
  memberBusinessIds: string[] // ACTIVE member businesses this caller can see
}

export async function resolveGroupContext(supabase: any, authUserId: string, groupIdHint?: string): Promise<GroupContext | null> {
  const { data: userData } = await supabase.from('users').select('id').eq('auth_id', authUserId).maybeSingle()
  if (!userData?.id) return null

  // Group owner first — an owner of a group is never merely "staff" of it,
  // mirroring how a business OWNER is resolved ahead of `staff` rows.
  let groupQuery = supabase.from('business_groups').select('id, name').eq('owner_user_id', userData.id)
  if (groupIdHint) groupQuery = groupQuery.eq('id', groupIdHint)
  const { data: ownedGroups } = await groupQuery
  if (ownedGroups?.[0]) {
    const memberBusinessIds = await getActiveMemberBusinessIds(supabase, ownedGroups[0].id)
    return { userId: userData.id, groupId: ownedGroups[0].id, groupName: ownedGroups[0].name, role: 'GROUP_OWNER', regionId: null, memberBusinessIds }
  }

  let staffQuery = supabase.from('group_staff').select('id, group_id, role, region_id, business_groups(name)').eq('user_id', userData.id).eq('is_active', true)
  if (groupIdHint) staffQuery = staffQuery.eq('group_id', groupIdHint)
  const { data: staffRows } = await staffQuery
  if (!staffRows?.length) return null

  const row = staffRows[0]
  const memberBusinessIds = await getActiveMemberBusinessIds(supabase, row.group_id)
  return {
    userId: userData.id, groupId: row.group_id, groupName: row.business_groups?.name ?? '',
    role: row.role, regionId: row.region_id ?? null, memberBusinessIds,
  }
}

async function getActiveMemberBusinessIds(supabase: any, groupId: string): Promise<string[]> {
  const { data } = await supabase.from('group_memberships').select('business_id').eq('group_id', groupId).eq('status', 'ACTIVE')
  return (data ?? []).map((r: any) => r.business_id)
}

export async function requireGroupPermission(supabase: any, authUserId: string, permission: GroupPermission, groupIdHint?: string): Promise<GroupContext | null> {
  const ctx = await resolveGroupContext(supabase, authUserId, groupIdHint)
  if (!ctx) return null
  if (!hasGroupPermission(ctx.role, permission)) return null
  return ctx
}

// A REGIONAL_MANAGER only ever sees businesses in their own region — this
// is the one place that scoping is applied, called by every group API
// route instead of using ctx.memberBusinessIds directly whenever the
// route is business-list-scoped.
export async function scopedBusinessIds(supabase: any, ctx: GroupContext): Promise<string[]> {
  if (ctx.role !== 'REGIONAL_MANAGER' || !ctx.regionId) return ctx.memberBusinessIds
  const { data } = await supabase.from('group_memberships').select('business_id').eq('group_id', ctx.groupId).eq('status', 'ACTIVE').eq('region_id', ctx.regionId)
  return (data ?? []).map((r: any) => r.business_id)
}
