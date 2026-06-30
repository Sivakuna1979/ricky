import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { runAgentTurn } from '@/lib/agent/engine'
import { nextCronRun } from '@/lib/agent/tools/reminders'
import { sendText, sendImage } from '@/lib/channels'
import type { Agent, Channel, Workspace } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Runs scheduled reminders/jobs that are due and purges history beyond each
// plan's retention window. Invoke from a scheduler (Vercel Cron / GitHub Action)
// every minute with header: Authorization: Bearer <CRON_SECRET>.
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const { data: jobs } = await supabase
    .from('scheduled_jobs')
    .select('*')
    .eq('status', 'scheduled')
    .lte('next_run_at', now)
    .limit(25)

  let ran = 0
  for (const job of jobs ?? []) {
    try {
      await supabase.from('scheduled_jobs').update({ status: 'running' }).eq('id', job.id)

      const { data: channel } = await supabase
        .from('channels')
        .select('*')
        .eq('id', job.channel_id)
        .maybeSingle<Channel>()
      const { data: agent } = await supabase
        .from('agents')
        .select('*')
        .eq('id', job.agent_id)
        .maybeSingle<Agent>()
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', job.workspace_id)
        .maybeSingle<Workspace>()

      if (channel && agent && workspace && job.recipient) {
        const result = await runAgentTurn({
          workspace,
          agent,
          channel,
          conversationId: '',
          recipient: job.recipient,
          history: [],
          userText: `Scheduled job "${job.name}": ${job.prompt}`,
        })
        if (result.imageUrl) {
          await sendImage(channel, job.recipient, result.imageUrl, result.text)
        } else {
          await sendText(channel, job.recipient, result.text)
        }
        ran++
      }

      // Recurring → reschedule; one-shot → done.
      if (job.cron) {
        const next = nextCronRun(job.cron)
        await supabase
          .from('scheduled_jobs')
          .update({
            status: 'scheduled',
            last_run_at: now,
            next_run_at: next?.toISOString() ?? null,
          })
          .eq('id', job.id)
      } else {
        await supabase
          .from('scheduled_jobs')
          .update({ status: 'done', last_run_at: now })
          .eq('id', job.id)
      }
    } catch (e) {
      console.error('job error', job.id, e)
      await supabase.from('scheduled_jobs').update({ status: 'error' }).eq('id', job.id)
    }
  }

  // 90-day (per plan) history retention — purge anything older than the max window.
  await supabase.rpc('purge_old_messages', { retention_days: 365 })

  return NextResponse.json({ ok: true, ran })
}

export async function GET(req: NextRequest) {
  return handle(req)
}
export async function POST(req: NextRequest) {
  return handle(req)
}
