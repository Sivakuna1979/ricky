// @ts-nocheck
// Manual stop status (G10) — never inferred from schedule time; actual_*
// timestamps are only ever set here, by a person. A note is also mirrored
// into business_memory (Phase F) so it's semantically searchable later
// (G51) — it's still just data, never an instruction (G52).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { markStopStatus } from '@/lib/routes/sessions'
import { getEmbedding, EMBEDDING_MODEL } from '@/lib/memory/embeddings'

// Body: { status?: 'arrived'|'departed'|'skipped', notes? }
export async function PATCH(req: NextRequest, { params }: { params: { id: string; stopId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const admin = await createAdminClient()
  const { data: session } = await admin.from('route_sessions').select('id, business_id').eq('id', params.id).maybeSingle()
  if (!session || session.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: stop } = await admin.from('route_session_stops').select('id, route_session_id, location_name').eq('id', params.stopId).eq('route_session_id', params.id).maybeSingle()
  if (!stop) return NextResponse.json({ error: 'Stop not found' }, { status: 404 })

  const body = await req.json()
  if (body.status) await markStopStatus(admin, params.stopId, body.status)

  if (body.notes?.trim()) {
    await admin.from('route_session_stops').update({ notes: body.notes.trim() }).eq('id', params.stopId)
    const content = `${stop.location_name}: ${body.notes.trim()}`
    const embedding = await getEmbedding(content)
    await admin.from('business_memory').insert({
      business_id: ctx.businessId, created_by: ctx.userId, category: 'route_note', title: stop.location_name, content,
      related_entity_type: 'route_session_stop', related_entity_id: params.stopId,
      embedding, embedding_model: embedding ? EMBEDDING_MODEL : null,
    })
  }

  const { data: updated } = await admin.from('route_session_stops').select('*').eq('id', params.stopId).maybeSingle()
  return NextResponse.json(updated)
}
