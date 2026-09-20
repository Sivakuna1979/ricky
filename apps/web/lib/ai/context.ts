// @ts-nocheck
// The one place FoodTaxi AI's business/permission context comes from
// (E2, E3). Built directly on the same lib/staffContext.ts every other
// Phase C/D route already uses — there is no separate, AI-specific way to
// resolve "who is this and what can they see", which is exactly what
// prevents the AI from ever being a shortcut around normal permissions.
import { getStaffContext, type StaffContext } from '@/lib/staffContext'

export type AiContext = StaffContext & { businessName: string; timezone: string }

export async function resolveAiContext(supabase: any, authUserId: string): Promise<AiContext | null> {
  const staffCtx = await getStaffContext(supabase, authUserId)
  if (!staffCtx) return null
  const { data: business } = await supabase.from('businesses').select('name, timezone').eq('id', staffCtx.businessId).maybeSingle()
  if (!business) return null
  return { ...staffCtx, businessName: business.name, timezone: business.timezone ?? 'Europe/London' }
}

// A van-restricted context (driver/staff assigned to specific vans, not
// "all vans") must never be handed a van_id outside their own list — used
// by every tool that takes an optional van_id.
export function assertVanAllowed(ctx: AiContext, vanId: string | null | undefined) {
  if (!vanId) return
  if (ctx.vanIds === null) return // unrestricted (owner, all-vans staff)
  if (!ctx.vanIds.includes(vanId)) throw new Error('van_not_authorised')
}

// The van id list a tool should actually query when none is specified —
// "all vans this caller can see", never "all vans in the business" for a
// van-restricted caller.
export async function allowedVanIds(admin: any, ctx: AiContext): Promise<string[]> {
  if (ctx.vanIds !== null) return ctx.vanIds
  const { data } = await admin.from('vans').select('id').eq('business_id', ctx.businessId)
  return (data ?? []).map((v: any) => v.id)
}
