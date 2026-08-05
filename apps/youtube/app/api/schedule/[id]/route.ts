import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  slot_date: z.string().optional(),
  slot_time: z.string().optional(),
  video_kind: z.enum(['short', 'long']).optional(),
  status: z.enum(['planned', 'skipped']).optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: schedule } = await supabase.from('yt_schedules').select('id, status, yt_channels!inner(user_id)').eq('id', id).maybeSingle()
  const channel = schedule ? (Array.isArray(schedule.yt_channels) ? schedule.yt_channels[0] : schedule.yt_channels) : null
  if (!schedule || channel?.user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (schedule.status === 'filled') return NextResponse.json({ error: 'Cannot edit a slot that has already been produced/uploaded' }, { status: 409 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { error } = await supabase.from('yt_schedules').update(parsed.data).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
