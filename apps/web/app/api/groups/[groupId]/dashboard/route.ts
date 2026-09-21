// @ts-nocheck
// M12 — /group/dashboard's data source. Every field returned is gated by
// its own specific group permission — a caller with only
// view_group_dashboard gets the headline directory/KPI view; finance
// detail, customer contact, staff personal data are never included here
// regardless of role (those are separate, narrower routes/permissions).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveGroupContext, scopedBusinessIds } from '@/lib/groups/context'
import { hasGroupPermission } from '@/lib/groups/permissions'
import {
  getGroupBusinessDirectory, getGroupKpiComparison, getGroupAttentionItems,
  getGroupStockSummary, getGroupHygieneSummary, getGroupVehicleAlerts, getGroupCustomerGrowthSummary,
} from '@/lib/groups/dashboard'

export async function GET(req: NextRequest, { params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'view_group_dashboard')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const businessIds = await scopedBusinessIds(supabase, ctx)

  const [directory, kpis, attention, stock, hygiene, vehicles, customers] = await Promise.all([
    hasGroupPermission(ctx.role, 'view_group_businesses') ? getGroupBusinessDirectory(admin, businessIds) : null,
    hasGroupPermission(ctx.role, 'view_group_sales_summary') ? getGroupKpiComparison(admin, businessIds) : null,
    hasGroupPermission(ctx.role, 'view_group_operations') ? getGroupAttentionItems(admin, businessIds) : null,
    hasGroupPermission(ctx.role, 'view_group_stock_summary') ? getGroupStockSummary(admin, businessIds) : null,
    hasGroupPermission(ctx.role, 'view_group_hygiene') ? getGroupHygieneSummary(admin, businessIds) : null,
    hasGroupPermission(ctx.role, 'view_group_vehicles') ? getGroupVehicleAlerts(admin, businessIds) : null,
    hasGroupPermission(ctx.role, 'view_group_customer_summary') ? getGroupCustomerGrowthSummary(admin, businessIds) : null,
  ])

  return NextResponse.json({
    group: { id: ctx.groupId, name: ctx.groupName, my_role: ctx.role, region_id: ctx.regionId },
    business_count: businessIds.length,
    directory, kpis, attention, stock, hygiene, vehicles, customers,
  })
}
