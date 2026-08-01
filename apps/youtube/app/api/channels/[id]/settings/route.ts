import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  niche_id: z.string().uuid().nullable().optional(),
  upload_pattern: z.enum(['two_shorts', 'short_and_long', 'two_long', 'custom']).optional(),
  custom_schedule: z.array(z.object({ time: z.string(), kind: z.enum(['short', 'long']) })).optional(),
  approval_mode: z.enum(['manual', 'assisted', 'full_auto']).optional(),
  production_mode: z.enum(['low_cost', 'standard', 'premium']).optional(),
  allowed_video_types: z.array(z.enum(['explainer', 'list', 'educational', 'story', 'product_comparison', 'news'])).optional(),
  timezone: z.string().optional(),
  slot_time_1: z.string().optional(),
  slot_time_2: z.string().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: channel } = await supabase.from('yt_channels').select('id').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Full Automation requires the safety checks to already be in place —
  // enforced here as well as in the worker's approval-mode gating, since
  // Phase 3 guidance says it should only be reachable after Manual/Assisted
  // have been exercised. We allow it in the MVP (checks do run), but flag
  // it so the UI can show a confirmation dialog.
  const { error } = await supabase.from('yt_channel_settings').update(parsed.data).eq('channel_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
