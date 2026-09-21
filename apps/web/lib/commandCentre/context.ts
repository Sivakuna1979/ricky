// @ts-nocheck
// K60-K62 — the one place every Command Centre API route resolves "who is
// asking, and which vans are they allowed to see". A Van Manager's
// effectiveVanIds is always the intersection with their own assignment
// (staffContext.vanIds) — never the whole business, even for a
// "business-wide" permission — so K61's "no automatic business-wide
// finance/CRM intelligence" for restricted roles holds no matter which
// route is called. business_id is NEVER taken from the request (K74) —
// always derived from the authenticated session via getStaffContext.
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission, type Permission } from '@/lib/permissions'

export async function resolveCommandCentreContext(permission: Permission, requestedVanId?: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const, status: 401 as const }

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return { error: 'No business found for this account' as const, status: 404 as const }
  if (!hasPermission(ctx.role, permission)) return { error: 'Not authorized' as const, status: 403 as const }

  const admin = await createAdminClient()
  const { data: allVans } = await admin.from('vans').select('id, name, slug, tracking_status, accepts_online_orders').eq('business_id', ctx.businessId).eq('is_active', true)
  const allVanIds = (allVans ?? []).map((v: any) => v.id)

  // null vanIds = unrestricted (OWNER or an "all vans" staff row).
  const scopedVanIds = ctx.vanIds == null ? allVanIds : allVanIds.filter((id: string) => ctx.vanIds.includes(id))

  let effectiveVanIds = scopedVanIds
  if (requestedVanId) {
    if (!scopedVanIds.includes(requestedVanId)) return { error: 'Not authorized for that van' as const, status: 403 as const }
    effectiveVanIds = [requestedVanId]
  }

  const { data: business } = await admin.from('businesses').select('id, name, timezone, created_at').eq('id', ctx.businessId).maybeSingle()

  return {
    admin, ctx, business, allVans: allVans ?? [], allVanIds, effectiveVanIds,
    restricted: ctx.vanIds != null,
  }
}
