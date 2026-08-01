import type { Job } from 'bullmq'
import { createAdminClient } from '@/lib/supabase/server'
import { withJobLog } from '@/lib/pipeline/job-logging'
import { runProduceVideoJob, resumeTopicApproval, resumeScriptApproval, resumeVideoApproval } from '../pipeline'
import type { ProduceQueueJobData } from '@/lib/queue/queues'

export async function processProduceVideo(job: Job<ProduceQueueJobData>) {
  const supabase = createAdminClient()
  const data = job.data
  const channelId = data.kind === 'produce' ? data.channelId : null

  await withJobLog(
    supabase,
    { channelId, jobName: job.name, queue: job.queueName, attempt: job.attemptsMade + 1, payload: data as Record<string, unknown> },
    async () => {
      switch (data.kind) {
        case 'produce':
          return runProduceVideoJob(data)
        case 'resume-topic':
          return resumeTopicApproval(data.topicId)
        case 'resume-script':
          return resumeScriptApproval(data.scriptId)
        case 'resume-video':
          return resumeVideoApproval(data.videoId)
      }
    }
  )
}
