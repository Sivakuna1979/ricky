import type { SupabaseClient } from '@supabase/supabase-js'
import { getPollUploadsQueue, getSyncAnalyticsQueue } from '@/lib/queue/queues'

// Shared by the (Hobby-plan-friendly) Vercel Cron routes for manual/backup
// triggering and by the worker's own setInterval loops (worker/index.ts).
// Vercel's free Hobby tier caps projects at 2 cron jobs, each running at
// most once a day — nowhere near what upload-status polling (~every 15m)
// or hourly analytics sync need, so those run from the always-on worker
// process instead, which has no such restriction.

export async function enqueuePendingUploadPolls(supabase: SupabaseClient) {
  const { data: pending, error } = await supabase
    .from('yt_uploads')
    .select('id')
    .in('upload_status', ['uploaded', 'scheduled'])
  if (error) throw error

  const queue = getPollUploadsQueue()
  for (const upload of pending ?? []) {
    await queue.add('poll-upload', { uploadId: upload.id }, { jobId: `poll-${upload.id}-${Date.now()}` })
  }
  return pending?.length ?? 0
}

export async function enqueueAnalyticsSync(supabase: SupabaseClient) {
  const { data: channels, error } = await supabase.from('yt_channels').select('id').eq('status', 'active')
  if (error) throw error

  const queue = getSyncAnalyticsQueue()
  for (const channel of channels ?? []) {
    await queue.add(
      'sync-analytics',
      { channelId: channel.id },
      { jobId: `analytics-${channel.id}-${new Date().toISOString().slice(0, 13)}` }
    )
  }
  return channels?.length ?? 0
}
