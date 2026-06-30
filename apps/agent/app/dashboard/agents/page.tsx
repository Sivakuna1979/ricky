import { getCurrentContext } from '@/lib/workspace'
import { createClient } from '@/lib/supabase/server'
import { getPlan } from '@/lib/plans'
import AgentEditor from '@/components/AgentEditor'
import CreateAgent from '@/components/CreateAgent'
import type { Agent } from '@/lib/types'

export default async function AgentsPage() {
  const { workspace } = await getCurrentContext()
  if (!workspace) return null
  const supabase = await createClient()
  const plan = getPlan(workspace.plan)
  const { data: agents } = await supabase
    .from('agents')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('created_at')

  const atLimit = (agents?.length ?? 0) >= plan.limits.agents

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Agents</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Configure your AI agents’ persona, tools and behaviour. Your plan allows{' '}
        {plan.limits.agents} agent(s).
      </p>
      <div className="mt-6">
        <CreateAgent atLimit={atLimit} />
      </div>
      <div className="mt-6 space-y-8">
        {(agents ?? []).map((a) => (
          <div key={a.id}>
            <h2 className="mb-2 font-semibold">{a.name}</h2>
            <AgentEditor agent={a as Agent} />
          </div>
        ))}
        {!agents?.length && <p className="text-sm text-neutral-500">No agents yet.</p>}
      </div>
    </div>
  )
}
