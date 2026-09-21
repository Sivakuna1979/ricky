// @ts-nocheck
// K24/K25 — simple monthly management budgets, with target vs actual.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveCommandCentreContext } from '@/lib/commandCentre/context'
import { getBudgetComparison } from '@/lib/commandCentre/budgets'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // 'YYYY-MM-01'
  const result = await resolveCommandCentreContext('view_business_intelligence')
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { admin, business, effectiveVanIds } = result

  const periodStart = month && /^\d{4}-\d{2}-01$/.test(month) ? month : `${new Date().toISOString().slice(0, 7)}-01`
  const periodEnd = new Date(new Date(`${periodStart}T00:00:00Z`).getFullYear(), new Date(`${periodStart}T00:00:00Z`).getMonth() + 1, 0).toISOString().slice(0, 10)

  const comparison = await getBudgetComparison(admin, business.id, effectiveVanIds, periodStart, periodEnd)
  return NextResponse.json({ period_start: periodStart, period_end: periodEnd, budgets: comparison })
}

const budgetSchema = z.object({
  category: z.enum(['revenue', 'stock_purchasing', 'vehicle_maintenance', 'marketing']),
  period_start: z.string().regex(/^\d{4}-\d{2}-01$/),
  budgeted_amount: z.number().min(0),
})

export async function POST(req: NextRequest) {
  const result = await resolveCommandCentreContext('manage_business_goals')
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { admin, business, ctx } = result

  const body = await req.json().catch(() => ({}))
  const parsed = budgetSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await admin.from('business_budgets').upsert({
    business_id: business.id, ...parsed.data, created_by: ctx.userId, updated_at: new Date().toISOString(),
  }, { onConflict: 'business_id,category,period_start' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent(admin, { actorId: ctx.userId, action: 'set_business_budget', entityType: 'business_budgets', entityId: data.id, newValues: parsed.data })
  return NextResponse.json(data, { status: 201 })
}
