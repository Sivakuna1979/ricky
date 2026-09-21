// @ts-nocheck
// M43 — group finance summary. Requires view_group_finance_summary at
// minimum; the `detail` flag (per-business breakdown with COGS coverage)
// additionally requires the separate, higher-stakes
// view_group_finance_detail permission — even then this is still only
// aggregate summary figures, never an invoice/cash-count/VAT export
// (those stay entirely inside each business's own Finance Hub, unreachable
// from any group route).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveGroupContext, scopedBusinessIds } from '@/lib/groups/context'
import { hasGroupPermission } from '@/lib/groups/permissions'
import { getGroupFinanceSummary } from '@/lib/groups/dashboard'

export async function GET(req: NextRequest, { params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'view_group_finance_summary')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const businessIds = await scopedBusinessIds(supabase, ctx)
  const range = new URL(req.url).searchParams.get('range') ?? 'this_week'
  const summary = await getGroupFinanceSummary(admin, businessIds, range)

  if (!hasGroupPermission(ctx.role, 'view_group_finance_detail')) {
    return NextResponse.json({ net_revenue: summary.net_revenue, gross_contribution: summary.gross_contribution })
  }
  return NextResponse.json(summary)
}
