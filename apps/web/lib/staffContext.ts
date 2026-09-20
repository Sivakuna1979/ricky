// @ts-nocheck
// Resolves "who is this caller, at which business, with what role and van
// scope" — the one place Phase C API routes derive authorization context
// from, instead of each route re-deriving it slightly differently. Never
// trusts a business_id/van_id from the request; always derives from the
// authenticated session.
import { staffRoleToBusinessRole, hasPermission, type Permission, type BusinessRole } from '@/lib/permissions'

export type StaffContext = {
  userId: string
  businessId: string
  role: BusinessRole
  staffId: string | null // null for OWNER (owners have no `staff` row)
  vanIds: string[] | null // null = unrestricted (all business vans)
}

// `supabase` = the caller's session-scoped client (respects RLS) — used
// only to identify the caller, never to authorize the action itself.
export async function getStaffContext(supabase: any, authUserId: string, businessIdHint?: string): Promise<StaffContext | null> {
  const { data: userData } = await supabase.from('users').select('id').eq('auth_id', authUserId).maybeSingle()
  if (!userData?.id) return null

  // Owner check first — an owner is never "staff" of their own business.
  let ownerQuery = supabase.from('businesses').select('id').eq('owner_id', userData.id)
  if (businessIdHint) ownerQuery = ownerQuery.eq('id', businessIdHint)
  const { data: ownedBusinesses } = await ownerQuery
  if (ownedBusinesses?.[0]) {
    return { userId: userData.id, businessId: ownedBusinesses[0].id, role: 'OWNER', staffId: null, vanIds: null }
  }

  // Active staff rows — may be multiple (one per assigned van), or one with
  // van_id = NULL meaning "all vans" (see my_van_ids() in the Phase C migration).
  let staffQuery = supabase.from('staff').select('id, business_id, van_id, role').eq('user_id', userData.id).eq('is_active', true)
  if (businessIdHint) staffQuery = staffQuery.eq('business_id', businessIdHint)
  const { data: staffRows } = await staffQuery
  if (!staffRows?.length) return null

  const businessId = staffRows[0].business_id
  const rowsForBusiness = staffRows.filter((r: any) => r.business_id === businessId)
  const role = staffRoleToBusinessRole(rowsForBusiness[0].role)
  if (!role) return null

  const hasAllVansRow = rowsForBusiness.some((r: any) => r.van_id === null)
  const vanIds = hasAllVansRow ? null : rowsForBusiness.map((r: any) => r.van_id).filter(Boolean)

  return { userId: userData.id, businessId, role, staffId: rowsForBusiness[0].id, vanIds }
}

// Convenience: resolve context AND require a specific permission in one call.
// Returns null if unauthenticated/no business/no permission — callers
// should treat null as a 403.
export async function requirePermission(supabase: any, authUserId: string, permission: Permission, businessIdHint?: string): Promise<StaffContext | null> {
  const ctx = await getStaffContext(supabase, authUserId, businessIdHint)
  if (!ctx) return null
  if (!hasPermission(ctx.role, permission)) return null
  return ctx
}
