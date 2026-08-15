import 'dotenv/config'
import { Worker } from 'bullmq'
import { getRedisConnection } from '@/lib/queue/connection'
import { QUEUE_NAMES } from '@/lib/queue/queues'
import { createAdminClient } from '@/lib/supabase/server'
import { enqueueAnalyticsSync, enqueuePendingUploadPolls } from '@/lib/pipeline/maintenance'
import { processProduceVideo } from './processors/produce-video'
import { processPollUploads } from './processors/poll-uploads'
import { processSyncAnalytics } from './processors/sync-analytics'

// Entry point for the standalone worker process. Deploy this (via `npm
// run worker`) to Railway / Render / Cloud Run / any long-running Node
// host with ffmpeg installed — never to Vercel serverless functions,
// which cannot run multi-minute ffmpeg renders or hold a persistent
// Redis/BullMQ connection. See DEPLOYMENT.md.

const connection = getRedisConnection()

const produceVideoWorker = new Worker(QUEUE_NAMES.produceVideo, processProduceVideo, {
  connection,
  concurrency: Number(process.env.WORKER_CONCURRENCY_RENDER ?? 1),
  lockDuration: 30 * 60 * 1000, // renders can legitimately take a long time
})

const pollUploadsWorker = new Worker(QUEUE_NAMES.pollUploads, processPollUploads, {
  connection,
  concurrency: Number(process.env.WORKER_CONCURRENCY_LIGHT ?? 5),
})

const syncAnalyticsWorker = new Worker(QUEUE_NAMES.syncAnalytics, processSyncAnalytics, {
  connection,
  concurrency: Number(process.env.WORKER_CONCURRENCY_LIGHT ?? 5),
})

for (const worker of [produceVideoWorker, pollUploadsWorker, syncAnalyticsWorker]) {
  worker.on('failed', (job, err) => {
    console.error(`[${worker.name}] job ${job?.id} failed:`, err?.message)
  })
  worker.on('completed', (job) => {
    console.log(`[${worker.name}] job ${job.id} completed`)
  })
}

console.log('YouTube automation worker started. Listening on queues:', Object.values(QUEUE_NAMES).join(', '))
console.log('Node version:', process.version, '| Redis configured:', !!process.env.REDIS_URL)

// Upload-status polling (~15 min) and analytics sync (hourly) run from
// this always-on process rather than Vercel Cron, since Vercel's free
// Hobby tier caps projects at 2 cron jobs / once a day each — nowhere
// near frequent enough for these. Only the twice-daily production-run
// trigger stays on Vercel Cron (see apps/youtube/vercel.json).
const adminClient = createAdminClient()
const POLL_UPLOADS_INTERVAL_MS = 15 * 60 * 1000
const SYNC_ANALYTICS_INTERVAL_MS = 60 * 60 * 1000

const pollUploadsInterval = setInterval(() => {
  enqueuePendingUploadPolls(adminClient).catch((err) => console.error('enqueuePendingUploadPolls failed:', err))
}, POLL_UPLOADS_INTERVAL_MS)

const syncAnalyticsInterval = setInterval(() => {
  enqueueAnalyticsSync(adminClient).catch((err) => console.error('enqueueAnalyticsSync failed:', err))
}, SYNC_ANALYTICS_INTERVAL_MS)

// Run once immediately on startup too, rather than waiting a full interval.
enqueuePendingUploadPolls(adminClient).catch((err) => console.error('enqueuePendingUploadPolls failed:', err))
enqueueAnalyticsSync(adminClient).catch((err) => console.error('enqueueAnalyticsSync failed:', err))

async function shutdown() {
  console.log('Shutting down worker...')
  clearInterval(pollUploadsInterval)
  clearInterval(syncAnalyticsInterval)
  await Promise.all([produceVideoWorker.close(), pollUploadsWorker.close(), syncAnalyticsWorker.close()])
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
