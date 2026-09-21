// @ts-nocheck
// PATCH /api/command-centre/attention/[id] — K55-K58. Acknowledge or
// dismiss an attention item. Never marks it RESOLVED directly — only
// lib/commandCentre/attention.ts's reconciliation (driven by the
// underlying condition actually disappearing) can do that, so a dismiss
// can never masquerade as a real fix (K57).
import { NextRequest, NextResponse } from 'next/server'
import { resolveCommandCentreContext } from '@/lib/commandCentre/context'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const result = await resolveCommandCentreContext('view_command_centre')
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { admin, business, ctx } = result

  const { action } = await req.json().catch(() => ({}))
  if (!['acknowledge', 'dismiss'].includes(action)) return NextResponse.json({ error: 'action must be acknowledge or dismiss' }, { status: 400 })

  const { data: row } = await admin.from('attention_items').select('id, business_id').eq('id', params.id).maybeSingle()
  if (!row || row.business_id !== business.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const state = action === 'acknowledge' ? 'ACKNOWLEDGED' : 'DISMISSED'
  const { error } = await admin.from('attention_items').update({
    state, state_changed_at: new Date().toISOString(), state_changed_by: ctx.userId,
  }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, state })
}
