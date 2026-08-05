import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { enqueueScriptApproved, enqueueTopicApproved, enqueueVideoApproved } from '@/lib/queue/queues'

const bodySchema = z.object({
  status: z.enum(['approved', 'rejected', 'changes_requested']),
  notes: z.string().max(2000).optional(),
})

// Drives the Manual / Assisted Automation gates: approving here is what
// lets the worker continue past the point it paused at. Rejecting stops
// that production run for good (nothing here is silently retried).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { status, notes } = parsed.data

  const { data: approval, error: approvalError } = await supabase
    .from('yt_approvals')
    .select('id, entity_type, entity_id, channel_id, status')
    .eq('id', id)
    .single()
  if (approvalError || !approval) return NextResponse.json({ error: 'Approval not found' }, { status: 404 })
  if (approval.status !== 'pending') {
    return NextResponse.json({ error: `Already decided (${approval.status}).` }, { status: 409 })
  }

  const { error: updateError } = await supabase
    .from('yt_approvals')
    .update({ status, notes, decided_by: user.id, decided_at: new Date().toISOString() })
    .eq('id', id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  const entityTables: Record<string, string> = { topic: 'yt_topics', script: 'yt_scripts', video: 'yt_videos', thumbnail: 'yt_thumbnails' }
  const table = entityTables[approval.entity_type]
  const entityStatus = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'needs_revision'
  if (table && (table === 'yt_topics' || table === 'yt_scripts')) {
    await supabase.from(table).update({ status: entityStatus }).eq('id', approval.entity_id)
  }

  if (status === 'approved') {
    switch (approval.entity_type) {
      case 'topic':
        await enqueueTopicApproved(approval.entity_id)
        break
      case 'script':
        await enqueueScriptApproved(approval.entity_id)
        break
      case 'video':
      case 'thumbnail':
        await enqueueVideoApproved(approval.entity_id)
        break
    }
  }

  return NextResponse.json({ ok: true })
}
