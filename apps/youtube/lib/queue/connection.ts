import IORedis from 'ioredis'

let connection: IORedis | null = null

// Shared by both the Next.js app (to enqueue jobs from API routes / cron)
// and the worker process (to consume them). BullMQ requires
// maxRetriesPerRequest: null on the connection it's given.
export function getRedisConnection(): IORedis {
  if (connection) return connection
  const url = process.env.REDIS_URL
  if (!url) {
    throw new Error('REDIS_URL is not set. Provision a Redis instance (Railway/Upstash/Render) — see SETUP.md.')
  }
  connection = new IORedis(url, { maxRetriesPerRequest: null })
  return connection
}
