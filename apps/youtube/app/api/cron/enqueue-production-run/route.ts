import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ensureScheduleAndEnqueue } from '@/lib/pipeline/scheduling'
import { requireCronSecret } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'

// Called twice a day by Vercel Cron (see vercel.json). This route itself
// only writes a couple of rows and pushes a job id onto Redis — it never
// touches ffmpeg or does any heavy work, so it's safe to run as a Vercel
// serverless function even though the actual rendering (in the worker
// process) is not.
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request)
  if (unauthorized) return unauthorized

  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const result = await ensureScheduleAndEnqueue(supabase, today)
  return NextResponse.json({ ok: true, date: today, ...result })
}
