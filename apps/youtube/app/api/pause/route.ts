import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const bodySchema = z.object({ paused: z.boolean(), reason: z.string().max(500).optional() })

// The emergency pause button. This sets a flag that every stage of the
// worker pipeline checks (see worker/pipeline.ts checkPause) before doing
// any further generation or upload work — in-flight ffmpeg renders finish,
// but nothing new starts and no upload goes out while paused.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { error } = await supabase
    .from('yt_profiles')
    .update({
      is_paused: parsed.data.paused,
      paused_at: parsed.data.paused ? new Date().toISOString() : null,
      paused_reason: parsed.data.paused ? parsed.data.reason ?? 'Manual emergency pause' : null,
    })
    .eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, paused: parsed.data.paused })
}
