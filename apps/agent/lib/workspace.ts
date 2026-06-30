import { createClient } from '@/lib/supabase/server'
import type { Workspace } from '@/lib/types'

// Resolve the authenticated user and their primary workspace for server
// components and route handlers. Returns nulls when unauthenticated.
export async function getCurrentContext(): Promise<{
  userId: string | null
  email: string | null
  workspace: Workspace | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { userId: null, email: null, workspace: null }

  // Owner workspace first; fall back to membership.
  const { data: owned } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<Workspace>()

  if (owned) return { userId: user.id, email: user.email ?? null, workspace: owned }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) return { userId: user.id, email: user.email ?? null, workspace: null }

  const { data: ws } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', membership.workspace_id)
    .maybeSingle<Workspace>()

  return { userId: user.id, email: user.email ?? null, workspace: ws ?? null }
}
