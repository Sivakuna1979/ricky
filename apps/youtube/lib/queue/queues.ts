import { Queue } from 'bullmq'
import { getRedisConnection } from './connection'

export const QUEUE_NAMES = {
  produceVideo: 'yt:produce-video',
  pollUploads: 'yt:poll-uploads',
  syncAnalytics: 'yt:sync-analytics',
} as const

const defaultJobOptions = {
  attempts: 4,
  backoff: { type: 'exponential' as const, delay: 15_000 },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 1000 },
}

export interface ProduceVideoJobData {
  channelId: string
  scheduleId: string
  videoKind: 'short' | 'long'
}

export type ProduceQueueJobData =
  | ({ kind: 'produce' } & ProduceVideoJobData)
  | { kind: 'resume-topic'; topicId: string }
  | { kind: 'resume-script'; scriptId: string }
  | { kind: 'resume-video'; videoId: string }

export interface PollUploadsJobData {
  uploadId: string
}

export interface SyncAnalyticsJobData {
  channelId: string
}

export function getProduceVideoQueue() {
  return new Queue<ProduceQueueJobData>(QUEUE_NAMES.produceVideo, {
    connection: getRedisConnection(),
    defaultJobOptions,
  })
}

export async function enqueueTopicApproved(topicId: string) {
  await getProduceVideoQueue().add('resume-topic', { kind: 'resume-topic', topicId }, { jobId: `resume-topic-${topicId}` })
}

export async function enqueueScriptApproved(scriptId: string) {
  await getProduceVideoQueue().add('resume-script', { kind: 'resume-script', scriptId }, { jobId: `resume-script-${scriptId}` })
}

export async function enqueueVideoApproved(videoId: string) {
  await getProduceVideoQueue().add('resume-video', { kind: 'resume-video', videoId }, { jobId: `resume-video-${videoId}` })
}

export function getPollUploadsQueue() {
  return new Queue<PollUploadsJobData>(QUEUE_NAMES.pollUploads, {
    connection: getRedisConnection(),
    defaultJobOptions: { ...defaultJobOptions, attempts: 10, backoff: { type: 'exponential', delay: 60_000 } },
  })
}

export function getSyncAnalyticsQueue() {
  return new Queue<SyncAnalyticsJobData>(QUEUE_NAMES.syncAnalytics, {
    connection: getRedisConnection(),
    defaultJobOptions,
  })
}
