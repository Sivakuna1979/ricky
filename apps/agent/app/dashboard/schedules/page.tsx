import { getCurrentContext } from '@/lib/workspace'
import { createClient } from '@/lib/supabase/server'
import ScheduleList from '@/components/ScheduleList'
import type { ScheduledJob } from '@/lib/types'

export default async function SchedulesPage() {
  const { workspace } = await getCurrentContext()
  if (!workspace) return null
  const supabase = await createClient()
  const { data: jobs } = await supabase
    .from('scheduled_jobs')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('next_run_at', { ascending: true })

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Scheduled jobs</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Reminders and recurring automations. Customers can ask your agent to set these up in chat.
      </p>
      <div className="mt-6">
        <ScheduleList jobs={(jobs ?? []) as ScheduledJob[]} />
      </div>
    </div>
  )
}
