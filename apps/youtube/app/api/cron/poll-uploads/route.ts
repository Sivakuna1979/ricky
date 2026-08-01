import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getPollUploadsQueue } from '@/lib/queue/queues'
import { requireCronSecret } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'

// Every 15 minutes, queue a status check for any upload that's been
// handed to YouTube but isn't confirmed published yet.
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request)
  if (unauthorized) return unauthorized

  const supabase = createAdminClient()
  const { data: pending, error } = await supabase
    .from('yt_uploads')
    .select('id')
    .in('upload_status', ['uploaded', 'scheduled'])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const queue = getPollUploadsQueue()
  for (const upload of pending ?? []) {
    await queue.add('poll-upload', { uploadId: upload.id }, { jobId: `poll-${upload.id}-${Date.now()}` })
  }

  return NextResponse.json({ ok: true, queued: pending?.length ?? 0 })
}
