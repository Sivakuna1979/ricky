// @ts-nocheck
// Centralised FoodTaxi Business subscription access check (Phase B5) — the
// single place that knows which subscription states grant access, mirroring
// how lib/isSuperAdmin.ts centralised admin authorization in Phase A.
//
// Edge-safe: only uses the passed-in Supabase client, no Node-only APIs, so
// it can run in both middleware.ts and ordinary server routes/pages.
//
// There is only one plan today, so this is a boolean gate rather than a
// tier system — but callers pass a business id, not a plan, so a future
// plan/feature system can be layered in here without touching call sites.

const ACCESS_GRANTING_STATUSES = ['trialing', 'active']

export type SubscriptionState = {
  status: string | null
  trial_ends_at: string | null
  current_period_end: string | null
  grandfathered: boolean
} | null

export async function getSubscriptionState(supabase: any, businessId: string): Promise<SubscriptionState> {
  if (!businessId) return null
  const { data } = await supabase
    .from('subscriptions')
    .select('status, trial_ends_at, current_period_end, grandfathered')
    .eq('business_id', businessId)
    .maybeSingle()
  return data ?? null
}

export function computeHasAccess(sub: SubscriptionState): boolean {
  if (!sub) return false
  if (sub.grandfathered) return true
  return ACCESS_GRANTING_STATUSES.includes(sub.status)
}

export async function hasActiveFoodTaxiAccess(supabase: any, businessId: string): Promise<boolean> {
  const sub = await getSubscriptionState(supabase, businessId)
  return computeHasAccess(sub)
}

export function trialDaysRemaining(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0
  const ms = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86400000))
}
