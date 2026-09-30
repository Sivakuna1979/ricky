import { authConfigured } from './config'
import { supabaseServer } from './server'
import { isPlan, type Plan } from '@/lib/plans'

export interface Viewer {
  authConfigured: boolean
  user: { id: string; email: string | null } | null
  plan: Plan
  /** True when auth isn't configured: the deployment runs as an open demo with every feature unlocked. */
  demoUnlocked: boolean
}

/**
 * Resolves who is viewing and which plan applies. Without Supabase configured the
 * app is a single-user demo; DEMO_PLAN (default "professional") sets the plan so every
 * module can be explored. With Supabase, anonymous visitors are on the free plan.
 */
export async function getViewer(): Promise<Viewer> {
  if (!authConfigured()) {
    const p = process.env.DEMO_PLAN
    return { authConfigured: false, user: null, plan: isPlan(p) ? p : 'professional', demoUnlocked: true }
  }
  const sb = supabaseServer()!
  const { data } = await sb.auth.getUser()
  if (!data.user) return { authConfigured: true, user: null, plan: 'free', demoUnlocked: false }
  const { data: row } = await sb.from('users').select('plan').eq('id', data.user.id).maybeSingle()
  return { authConfigured: true, user: { id: data.user.id, email: data.user.email ?? null }, plan: isPlan(row?.plan) ? row.plan : 'free', demoUnlocked: false }
}

export function viewerKey(v: Viewer, fallback: string) {
  return v.user?.id ?? fallback
}
