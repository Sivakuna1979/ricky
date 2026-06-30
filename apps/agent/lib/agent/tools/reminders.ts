import { createAdminClient } from '@/lib/supabase/server'
import { nextCronRun } from './cron'

export { nextCronRun }

interface ReminderArgs {
  workspaceId: string
  agentId: string | null
  channelId: string
  recipient: string
  name: string
  prompt: string
  // ISO timestamp for a one-shot reminder, or a cron expression for recurring.
  runAt?: string
  cron?: string
}

// Create a scheduled job/reminder. The cron runner (api/cron/run-jobs) picks it
// up when next_run_at is due and has the agent generate + deliver the message.
export async function scheduleReminder(args: ReminderArgs): Promise<string> {
  const supabase = createAdminClient()

  let nextRunAt: string | null = null
  if (args.runAt) {
    nextRunAt = new Date(args.runAt).toISOString()
  } else if (args.cron) {
    nextRunAt = nextCronRun(args.cron)?.toISOString() ?? null
  }

  if (!nextRunAt) return 'Could not schedule: provide either a valid time or cron expression.'

  const { error } = await supabase.from('scheduled_jobs').insert({
    workspace_id: args.workspaceId,
    agent_id: args.agentId,
    channel_id: args.channelId,
    recipient: args.recipient,
    name: args.name,
    prompt: args.prompt,
    cron: args.cron ?? null,
    run_at: args.runAt ?? null,
    next_run_at: nextRunAt,
    status: 'scheduled',
  })

  if (error) return `Failed to schedule reminder: ${error.message}`
  return `Reminder "${args.name}" scheduled for ${new Date(nextRunAt).toLocaleString()}.`
}
