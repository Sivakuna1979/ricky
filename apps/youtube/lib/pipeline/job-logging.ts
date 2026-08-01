import type { SupabaseClient } from '@supabase/supabase-js'

export async function withJobLog<T>(
  supabase: SupabaseClient,
  meta: { channelId?: string | null; videoId?: string | null; topicId?: string | null; jobName: string; queue: string; attempt: number; payload?: Record<string, unknown> },
  fn: () => Promise<T>
): Promise<T> {
  const { data: log } = await supabase
    .from('yt_job_logs')
    .insert({
      channel_id: meta.channelId ?? null,
      video_id: meta.videoId ?? null,
      topic_id: meta.topicId ?? null,
      job_name: meta.jobName,
      queue: meta.queue,
      status: 'running',
      attempt: meta.attempt,
      payload: meta.payload ?? {},
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  const start = Date.now()
  try {
    const result = await fn()
    if (log) {
      await supabase
        .from('yt_job_logs')
        .update({ status: 'completed', finished_at: new Date().toISOString(), duration_ms: Date.now() - start })
        .eq('id', log.id)
    }
    return result
  } catch (err) {
    if (log) {
      await supabase
        .from('yt_job_logs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - start,
          error_message: err instanceof Error ? err.message : String(err),
        })
        .eq('id', log.id)
    }
    throw err
  }
}
