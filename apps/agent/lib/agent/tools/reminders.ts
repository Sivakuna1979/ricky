import { createAdminClient } from '@/lib/supabase/server'

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

// Minimal cron parser supporting the common 5-field form (m h dom mon dow).
// Returns the next fire time after `from`, or null if it cannot be computed
// within a one-year horizon. Sufficient for reminders; swap for a library
// (e.g. cron-parser) for full feature coverage.
export function nextCronRun(expr: string, from = new Date()): Date | null {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const [min, hour, dom, mon, dow] = parts

  const match = (field: string, value: number, min: number, max: number): boolean => {
    if (field === '*') return true
    for (const token of field.split(',')) {
      if (token.includes('/')) {
        const [, stepStr] = token.split('/')
        const step = parseInt(stepStr, 10)
        if (step > 0 && (value - min) % step === 0) return true
      } else if (token.includes('-')) {
        const [a, b] = token.split('-').map((n) => parseInt(n, 10))
        if (value >= a && value <= b) return true
      } else if (parseInt(token, 10) === value) {
        return true
      }
    }
    return false
  }

  const cursor = new Date(from.getTime() + 60_000 - (from.getTime() % 60_000))
  const horizon = new Date(from.getTime() + 366 * 24 * 60 * 60 * 1000)
  while (cursor < horizon) {
    if (
      match(min, cursor.getMinutes(), 0, 59) &&
      match(hour, cursor.getHours(), 0, 23) &&
      match(dom, cursor.getDate(), 1, 31) &&
      match(mon, cursor.getMonth() + 1, 1, 12) &&
      match(dow, cursor.getDay(), 0, 6)
    ) {
      return new Date(cursor)
    }
    cursor.setMinutes(cursor.getMinutes() + 1)
  }
  return null
}
