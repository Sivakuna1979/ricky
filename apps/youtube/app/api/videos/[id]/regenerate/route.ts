import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProduceVideoQueue } from '@/lib/queue/queues'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: video, error } = await supabase
    .from('yt_videos')
    .select('id, script_id, yt_channels!inner(user_id)')
    .eq('id', id)
    .single()
  if (error || !video) return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  const channel = Array.isArray(video.yt_channels) ? video.yt_channels[0] : video.yt_channels
  if (channel.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await supabase.from('yt_videos').update({ render_status: 'failed' }).eq('id', id)

  await getProduceVideoQueue().add(
    'resume-script',
    { kind: 'resume-script', scriptId: video.script_id },
    { jobId: `resume-script-${video.script_id}-${Date.now()}` }
  )

  return NextResponse.json({ ok: true })
}
