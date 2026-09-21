// @ts-nocheck
// K24/K25 — budget vs actual, explicitly distinguishing recorded actual
// from committed (ordered, not yet received) and unpaid (invoiced, not
// yet paid) so nothing is double-counted as both "spent" and "owed".
import { round2, sum } from '@/lib/finance/money'
import { getSalesSummary } from '@/lib/finance/revenue'
import { getVehicleCosts, getEquipmentCosts } from '@/lib/finance/reports'

async function stockPurchasingActuals(admin: any, businessId: string, vanIds: string[], startDate: string, endDate: string) {
  // Recorded actual = confirmed supplier invoices dated in this period
  // (an invoice is a real, business-confirmed liability/cost — not an
  // OCR-extracted draft; see supplierPrices.ts's own comment on this).
  const { data: invoices } = await admin.from('supplier_invoices').select('gross_amount, status, invoice_date')
    .eq('business_id', businessId).gte('invoice_date', startDate).lte('invoice_date', endDate).neq('status', 'VOID')
  const recordedActual = sum((invoices ?? []).map((i: any) => i.gross_amount))
  const unpaid = sum((invoices ?? []).filter((i: any) => ['UNPAID', 'PARTIALLY_PAID'].includes(i.status)).map((i: any) => i.gross_amount))

  // Committed = purchase orders placed but not yet fully received, whose
  // line items fall in this period (by the PO's own expected/created date).
  const { data: pos } = await admin.from('purchase_orders').select('id, status, created_at, purchase_order_items(quantity_ordered, quantity_received, unit_cost)')
    .eq('business_id', businessId).in('status', ['ORDERED', 'PARTIALLY_RECEIVED']).gte('created_at', `${startDate}T00:00:00Z`).lte('created_at', `${endDate}T23:59:59Z`)
  let committed = 0
  for (const po of pos ?? []) {
    for (const item of po.purchase_order_items ?? []) {
      const outstandingQty = Math.max(0, (item.quantity_ordered ?? 0) - (item.quantity_received ?? 0))
      committed += outstandingQty * (item.unit_cost ?? 0)
    }
  }
  return { recorded_actual: recordedActual, committed: round2(committed), unpaid }
}

export async function getBudgetComparison(admin: any, businessId: string, vanIds: string[], startDate: string, endDate: string) {
  const { data: budgets } = await admin.from('business_budgets').select('*').eq('business_id', businessId).eq('period_start', startDate)
  const startIso = `${startDate}T00:00:00.000Z`
  const endIso = `${new Date(new Date(`${endDate}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10)}T00:00:00.000Z`

  const [sales, vehicle, equipment, stockPurchasing, marketingExpenses] = await Promise.all([
    getSalesSummary(admin, businessId, { vanIds, startIso, endIso }),
    getVehicleCosts(admin, businessId, vanIds, startDate, endDate),
    getEquipmentCosts(admin, businessId, vanIds, startDate, endDate),
    stockPurchasingActuals(admin, businessId, vanIds, startDate, endDate),
    admin.from('expenses').select('gross_amount, category').eq('business_id', businessId).eq('status', 'CONFIRMED').ilike('category', '%marketing%').gte('expense_date', startDate).lte('expense_date', endDate),
  ])

  const actuals: Record<string, any> = {
    revenue: { recorded_actual: sales.net_revenue },
    stock_purchasing: stockPurchasing,
    vehicle_maintenance: { recorded_actual: round2(vehicle.total + equipment.total) },
    marketing: { recorded_actual: sum((marketingExpenses.data ?? []).map((e: any) => e.gross_amount)), note: 'Based on expenses tagged with a "marketing" category — log spend there to track it here.' },
  }

  const byCategory = Object.fromEntries((budgets ?? []).map((b: any) => [b.category, b]))
  const categories = ['revenue', 'stock_purchasing', 'vehicle_maintenance', 'marketing']
  return categories.map((category) => ({
    category,
    budgeted_amount: byCategory[category]?.budgeted_amount ?? null,
    ...actuals[category],
    variance: byCategory[category]?.budgeted_amount != null ? round2((actuals[category].recorded_actual ?? 0) - byCategory[category].budgeted_amount) : null,
  }))
}
