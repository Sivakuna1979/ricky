// @ts-nocheck
// K23 — owner-configured operational targets.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveCommandCentreContext } from '@/lib/commandCentre/context'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET() {
  const result = await resolveCommandCentreContext('view_command_centre')
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { admin, business } = result

  const { data, error } = await admin.from('business_goals').select('*').eq('business_id', business.id).eq('is_active', true).order('goal_type')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ goals: data ?? [] })
}

const goalSchema = z.object({
  goal_type: z.enum(['revenue', 'wastage_ceiling_pct', 'hygiene_completion_pct', 'stockout_count_ceiling', 'repeat_customer_rate_pct']),
  period: z.enum(['weekly', 'monthly']).default('monthly'),
  target_value: z.number(),
})

// K26 — goals are targets, never a gamified safety/compliance score:
// hygiene_completion_pct is allowed here as a target like any other, but
// nothing in this route (or anywhere in the Command Centre) turns it into
// a leaderboard, badge, or ranking.
export async function POST(req: NextRequest) {
  const result = await resolveCommandCentreContext('manage_business_goals')
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { admin, business, ctx } = result

  const body = await req.json().catch(() => ({}))
  const parsed = goalSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // K23 — a new goal of the same type supersedes the old one (kept, not
  // deleted, for a simple audit trail).
  await admin.from('business_goals').update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('business_id', business.id).eq('goal_type', parsed.data.goal_type).eq('is_active', true)

  const { data, error } = await admin.from('business_goals').insert({
    business_id: business.id, goal_type: parsed.data.goal_type, period: parsed.data.period,
    target_value: parsed.data.target_value, created_by: ctx.userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent(admin, { actorId: ctx.userId, action: 'set_business_goal', entityType: 'business_goals', entityId: data.id, newValues: parsed.data })
  return NextResponse.json(data, { status: 201 })
}
