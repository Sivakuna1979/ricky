import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getSyncAnalyticsQueue } from '@/lib/queue/queues'
import { requireCronSecret } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'

// Hourly: queue an analytics refresh for every connected channel with at
// least one published video.
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request)
  if (unauthorized) return unauthorized

  const supabase = createAdminClient()
  const { data: channels, error } = await supabase.from('yt_channels').select('id').eq('status', 'active')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const queue = getSyncAnalyticsQueue()
  for (const channel of channels ?? []) {
    await queue.add('sync-analytics', { channelId: channel.id }, { jobId: `analytics-${channel.id}-${new Date().toISOString().slice(0, 13)}` })
  }

  return NextResponse.json({ ok: true, queued: channels?.length ?? 0 })
}
