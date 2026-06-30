import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentContext } from '@/lib/workspace'
import { getPlan } from '@/lib/plans'

// Create a new agent in the caller's workspace, enforcing the plan's agent limit.
export async function POST(req: NextRequest) {
  const { workspace } = await getCurrentContext()
  if (!workspace) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const plan = getPlan(workspace.plan)

  const { count } = await supabase
    .from('agents')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspace.id)
  if ((count ?? 0) >= plan.limits.agents) {
    return NextResponse.json({ error: 'Agent limit reached for your plan.' }, { status: 403 })
  }

  const { name, system_prompt } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { data, error } = await supabase
    .from('agents')
    .insert({
      workspace_id: workspace.id,
      name,
      system_prompt: system_prompt || 'You are a helpful assistant.',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ agent: data })
}
