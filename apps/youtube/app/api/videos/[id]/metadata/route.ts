import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(5000).optional(),
  tags: z.array(z.string()).max(500).optional(),
  hashtags: z.array(z.string()).max(15).optional(),
  pinned_comment: z.string().max(500).optional(),
  chapters: z.array(z.object({ time_seconds: z.number(), title: z.string() })).optional(),
})

// Lets the dashboard's "Edit title / description / thumbnail / schedule"
// controls change generated metadata before upload (or, if already
// uploaded, this only updates our own record — re-syncing to a live
// YouTube video is a Phase 2 "update metadata" action).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: video } = await supabase.from('yt_videos').select('id, yt_channels!inner(user_id)').eq('id', id).maybeSingle()
  const channel = video ? (Array.isArray(video.yt_channels) ? video.yt_channels[0] : video.yt_channels) : null
  if (!video || channel?.user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { error } = await supabase.from('yt_video_metadata').update(parsed.data).eq('video_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
