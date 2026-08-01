import type { Job } from 'bullmq'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthorizedClientForChannel } from '@/lib/youtube/oauth'
import { getVideoProcessingStatus } from '@/lib/youtube/client'
import { notify } from '@/lib/pipeline/notifications'
import type { PollUploadsJobData } from '@/lib/queue/queues'

// Re-checks a single upload's processing/publish status. Enqueued
// repeatedly (with backoff) until YouTube reports the video as fully
// processed and public, so we can confirm "successfully published" rather
// than just "successfully uploaded".
export async function processPollUploads(job: Job<PollUploadsJobData>) {
  const supabase = createAdminClient()
  const { data: upload, error } = await supabase
    .from('yt_uploads')
    .select('*, yt_channels(*)')
    .eq('id', job.data.uploadId)
    .single()
  if (error) throw error
  if (!upload.youtube_video_id || upload.upload_status === 'published') return

  const auth = await getAuthorizedClientForChannel(supabase, upload.yt_channels)
  const status = await getVideoProcessingStatus(auth, upload.youtube_video_id)

  await supabase
    .from('yt_uploads')
    .update({ processing_status: status.processingStatus, privacy_status: status.privacyStatus as any })
    .eq('id', upload.id)

  if (status.failureReason) {
    await supabase.from('yt_uploads').update({ upload_status: 'failed', error_message: status.failureReason }).eq('id', upload.id)
    await notify(supabase, {
      userId: upload.yt_channels.user_id,
      type: 'upload_failed',
      title: 'YouTube rejected the upload',
      body: status.failureReason,
      relatedEntity: { uploadId: upload.id },
    })
    return
  }

  if (status.privacyStatus === 'public' && upload.upload_status !== 'published') {
    await supabase.from('yt_uploads').update({ upload_status: 'published', published_at: new Date().toISOString() }).eq('id', upload.id)
    await notify(supabase, {
      userId: upload.yt_channels.user_id,
      type: 'video_published',
      title: 'Video published',
      body: `https://youtu.be/${upload.youtube_video_id} is now live.`,
      relatedEntity: { uploadId: upload.id, youtubeVideoId: upload.youtube_video_id },
    })
    return
  }

  // Not finished yet — throwing here lets BullMQ's backoff/retry re-run
  // this same job later rather than us hand-rolling a poll loop.
  if (status.processingStatus !== 'succeeded' && status.processingStatus !== 'terminated') {
    throw new Error(`Still processing (status=${status.processingStatus}); will re-check.`)
  }
}
