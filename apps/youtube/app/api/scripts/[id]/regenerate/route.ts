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

  const { data: script, error } = await supabase
    .from('yt_scripts')
    .select('id, topic_id, yt_topics!inner(id, channel_id, yt_channels!inner(user_id))')
    .eq('id', id)
    .single()
  if (error || !script) return NextResponse.json({ error: 'Script not found' }, { status: 404 })
  const topic = Array.isArray(script.yt_topics) ? script.yt_topics[0] : script.yt_topics
  const channel = Array.isArray(topic.yt_channels) ? topic.yt_channels[0] : topic.yt_channels
  if (channel.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await supabase.from('yt_scripts').update({ status: 'rejected' }).eq('id', id)
  await supabase.from('yt_topics').update({ status: 'approved' }).eq('id', topic.id)

  await getProduceVideoQueue().add(
    'resume-topic',
    { kind: 'resume-topic', topicId: topic.id },
    { jobId: `resume-topic-${topic.id}-${Date.now()}` }
  )

  return NextResponse.json({ ok: true })
}
