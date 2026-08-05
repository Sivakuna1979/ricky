import 'dotenv/config'
import { createAdminClient } from '@/lib/supabase/server'
import { ensureScheduleAndEnqueue } from '@/lib/pipeline/scheduling'

// Optional standalone alternative to Vercel Cron: run this with a process
// scheduler on the worker host (e.g. a Railway Cron Job / `node-cron` /
// system crontab calling `npm run scheduler`) if you'd rather not rely on
// Vercel Cron hitting /api/cron/enqueue-production-run. Both paths call
// the same idempotent ensureScheduleAndEnqueue() function.
async function main() {
  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const result = await ensureScheduleAndEnqueue(supabase, today)
  console.log(`Scheduler run for ${today}:`, result)
  process.exit(0)
}

main().catch((err) => {
  console.error('Scheduler run failed:', err)
  process.exit(1)
})
