// @ts-nocheck
// K8 — the KPI snapshot. Every figure is read straight from its owning
// phase's authoritative composer — nothing here recomputes revenue, COGS,
// wastage or retention a second way.
import { round2, sum } from '@/lib/finance/money'
import { getManagementReport } from '@/lib/finance/reports'
import { getRetentionSummary } from '@/lib/crm/retention'

export async function getKpiSnapshot(admin: any, businessId: string, vanIds: string[], opts: { startIso: string; endIso: string; startDate: string; endDate: string }) {
  const [mgmt, retention, wastage, loyaltyRedemptions] = await Promise.all([
    getManagementReport(admin, businessId, { vanIds, ...opts }),
    getRetentionSummary(admin, businessId, vanIds, opts.startDate, opts.endDate),
    admin.from('wastage_records').select('cost').eq('business_id', businessId).gte('created_at', opts.startIso).lt('created_at', opts.endIso),
    admin.from('loyalty_ledger').select('id').eq('business_id', businessId).eq('type', 'REDEEM').gte('created_at', opts.startIso).lt('created_at', opts.endIso),
  ])

  const { data: orders } = await admin.from('orders').select('id, total, status').in('van_id', vanIds).gte('created_at', opts.startIso).lt('created_at', opts.endIso)
  const validOrders = (orders ?? []).filter((o: any) => o.status !== 'cancelled')
  const orderCount = validOrders.length
  const aov = orderCount ? round2(sum(validOrders.map((o: any) => o.total)) / orderCount) : null

  return {
    period: { start: opts.startDate, end: opts.endDate },
    revenue: mgmt.sales_net_revenue,
    orders: orderCount,
    average_order_value: aov,
    known_gross_contribution: mgmt.gross_contribution,
    cogs_coverage_pct: mgmt.cogs_coverage_pct,
    recorded_expenses: mgmt.recorded_operating_expenses,
    wastage_cost: round2(sum((wastage.data ?? []).map((w: any) => w.cost))),
    new_customers: retention?.new_customers ?? 0,
    returning_customers: retention?.returning_customers ?? 0,
    repeat_purchase_rate_pct: retention?.repeat_purchase_rate_pct ?? 0,
    loyalty_redemptions: (loyaltyRedemptions.data ?? []).length,
    disclosure: mgmt.disclosure,
  }
}
