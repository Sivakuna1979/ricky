import type { Job } from 'bullmq'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthorizedClientForChannel } from '@/lib/youtube/oauth'
import { getVideoStatistics } from '@/lib/youtube/client'
import type { SyncAnalyticsJobData } from '@/lib/queue/queues'

// Pulls the (public, always-available) videos.list statistics for every
// published video on a channel. Deeper metrics — impressions, CTR,
// audience-retention curves, traffic sources, Shorts swipe-away rate —
// require the separate YouTube Analytics API (scope already requested at
// connect time) and per-video reports; wire that up here once a channel
// has enough published history for it to be meaningful (see CHECKLIST.md).
export async function processSyncAnalytics(job: Job<SyncAnalyticsJobData>) {
  const supabase = createAdminClient()
  const { data: channel, error: channelError } = await supabase.from('yt_channels').select('*').eq('id', job.data.channelId).single()
  if (channelError) throw channelError

  const { data: uploads, error: uploadsError } = await supabase
    .from('yt_uploads')
    .select('video_id, youtube_video_id')
    .eq('channel_id', channel.id)
    .eq('upload_status', 'published')
    .not('youtube_video_id', 'is', null)
  if (uploadsError) throw uploadsError
  if (!uploads?.length) return

  const auth = await getAuthorizedClientForChannel(supabase, channel)
  const stats = await getVideoStatistics(auth, uploads.map((u) => u.youtube_video_id as string))
  const today = new Date().toISOString().slice(0, 10)

  for (const stat of stats) {
    const upload = uploads.find((u) => u.youtube_video_id === stat.videoId)
    if (!upload) continue
    await supabase.from('yt_analytics').upsert(
      {
        video_id: upload.video_id,
        metric_date: today,
        views: stat.views,
        likes: stat.likes,
        comments: stat.comments,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'video_id,metric_date' }
    )
  }
}
