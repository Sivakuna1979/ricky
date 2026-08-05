import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { enqueuePendingUploadPolls } from '@/lib/pipeline/maintenance'
import { requireCronSecret } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'

// Not on the Vercel Cron schedule (Hobby plan caps cron jobs at 2, once a
// day each) — the worker's own interval loop (worker/index.ts) is the
// primary trigger for this. This route stays as a manual/backup trigger
// and for Pro-plan deployments that want it on Vercel Cron too.
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request)
  if (unauthorized) return unauthorized

  const supabase = createAdminClient()
  try {
    const queued = await enqueuePendingUploadPolls(supabase)
    return NextResponse.json({ ok: true, queued })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
