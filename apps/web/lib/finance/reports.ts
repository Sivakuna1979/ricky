// @ts-nocheck
// H28–H31, H38–H40 — vehicle/equipment/van costs, management (P&L-style)
// report, and cash-flow view. Every figure here is composed from the
// source-of-truth tables named in the Phase H migration's audit comment;
// nothing is stored or duplicated.
import { round2, sum } from './money'
import { getSalesSummary } from './revenue'
import { getExpenseSummary } from './expenses'
import { getCogsSummary } from './cogs'

// H28/H29 — vehicle costs read directly from vehicle_maintenance (already
// authoritative per the H1 audit), by maintenance_date, never re-entered
// as an expense.
export async function getVehicleCosts(admin: any, businessId: string, vanIds: string[], startDate: string, endDate: string) {
  if (!vanIds.length) return { total: 0, byVan: {} }
  const { data } = await admin.from('vehicle_maintenance').select('van_id, cost, maintenance_date').in('van_id', vanIds).gte('maintenance_date', startDate).lte('maintenance_date', endDate)
  const byVan: Record<string, number> = {}
  for (const v of data ?? []) byVan[v.van_id] = round2((byVan[v.van_id] ?? 0) + (v.cost ?? 0))
  return { total: sum((data ?? []).map((v: any) => v.cost)), byVan }
}

// H28/H29 — equipment costs, from equipment_maintenance, joined through
// equipment.van_id (equipment with no van is business-wide, excluded from
// a per-van figure but included in the business total — H31: "avoid
// arbitrary allocation of business-wide overheads").
export async function getEquipmentCosts(admin: any, businessId: string, vanIds: string[], startDate: string, endDate: string) {
  const { data: equipment } = await admin.from('equipment').select('id, van_id').eq('business_id', businessId)
  const vanByEquipment: Record<string, string | null> = Object.fromEntries((equipment ?? []).map((e: any) => [e.id, e.van_id]))
  const equipmentIds = (equipment ?? []).map((e: any) => e.id)
  if (!equipmentIds.length) return { total: 0, byVan: {}, unallocated: 0 }

  const { data } = await admin.from('equipment_maintenance').select('equipment_id, cost, maintenance_date').in('equipment_id', equipmentIds).gte('maintenance_date', startDate).lte('maintenance_date', endDate)
  const byVan: Record<string, number> = {}
  let unallocated = 0
  for (const m of data ?? []) {
    const vanId = vanByEquipment[m.equipment_id]
    if (vanId && vanIds.includes(vanId)) byVan[vanId] = round2((byVan[vanId] ?? 0) + (m.cost ?? 0))
    else unallocated = round2(unallocated + (m.cost ?? 0))
  }
  return { total: sum((data ?? []).map((m: any) => m.cost)), byVan, unallocated }
}

// H28–H31 — one van's finance view: revenue, known COGS/gross
// contribution, and its own directly-attributed vehicle/equipment costs
// only (never a slice of unrelated business-wide overhead).
export async function getVanFinance(admin: any, businessId: string, vanId: string, opts: { startIso: string; endIso: string; startDate: string; endDate: string }) {
  const [sales, cogs, vehicle, equipment] = await Promise.all([
    getSalesSummary(admin, businessId, { vanIds: [vanId], startIso: opts.startIso, endIso: opts.endIso }),
    getCogsSummary(admin, businessId, { vanIds: [vanId], ...opts }),
    getVehicleCosts(admin, businessId, [vanId], opts.startDate, opts.endDate),
    getEquipmentCosts(admin, businessId, [vanId], opts.startDate, opts.endDate),
  ])
  const vehicleCost = vehicle.byVan[vanId] ?? 0
  const equipmentCost = equipment.byVan[vanId] ?? 0
  return {
    revenue: sales.net_revenue, orders: sales.orders,
    gross_contribution: cogs.gross_contribution, cogs_coverage_pct: cogs.coverage_pct,
    vehicle_cost: vehicleCost, equipment_cost: equipmentCost,
    estimated_gross_contribution_after_vehicle_equipment: round2(cogs.gross_contribution - vehicleCost - equipmentCost),
  }
}

// H38–H40 — the management (P&L-style) report. Every line is labelled by
// what it actually is; nothing here is called "net profit" or presented
// as statutory accounts.
export async function getManagementReport(admin: any, businessId: string, opts: { vanIds: string[]; startIso: string; endIso: string; startDate: string; endDate: string }) {
  const [sales, cogs, expenseSummary, vehicle, equipment] = await Promise.all([
    getSalesSummary(admin, businessId, opts),
    getCogsSummary(admin, businessId, opts),
    getExpenseSummary(admin, businessId, opts),
    getVehicleCosts(admin, businessId, opts.vanIds, opts.startDate, opts.endDate),
    getEquipmentCosts(admin, businessId, opts.vanIds, opts.startDate, opts.endDate),
  ])
  const recordedOperatingExpenses = round2(expenseSummary.total_gross + vehicle.total + equipment.total)
  const recordedOperatingResult = round2(cogs.gross_contribution - recordedOperatingExpenses)

  return {
    period: { start: opts.startDate, end: opts.endDate },
    sales_net_revenue: sales.net_revenue,
    known_cogs: cogs.known_cogs,
    gross_contribution: cogs.gross_contribution,
    cogs_coverage_pct: cogs.coverage_pct,
    recorded_operating_expenses: recordedOperatingExpenses,
    expenses_breakdown: expenseSummary.by_category,
    vehicle_costs: vehicle.total,
    equipment_costs: equipment.total,
    recorded_operating_result: recordedOperatingResult,
    disclosure: 'This is a management summary built only from figures FoodTaxi has recorded. It is not statutory accounts, and any revenue with an incomplete recipe/cost (see cogs_coverage_pct) is excluded from gross contribution, not estimated.',
  }
}

// H40 — cash-flow view. Distinguishes WHEN money is recorded to have
// actually moved (a payment date) from an invoice/expense's own date
// (H40's explicit requirement). Expense outflow uses expense_date as a
// proxy for payment date (no separate "paid on" field exists for a
// manual/receipt expense — documented; supplier invoice payments use
// their own real paid_at, which is more accurate).
export async function getCashFlowView(admin: any, businessId: string, vanIds: string[], startDate: string, endDate: string) {
  const startIso = `${startDate}T00:00:00.000Z`
  const endIso = new Date(new Date(`${endDate}T00:00:00Z`).getTime() + 86400000).toISOString()

  const sales = await getSalesSummary(admin, businessId, { vanIds, startIso, endIso })

  const { data: invoicePayments } = await admin.from('customer_invoice_payments')
    .select('amount, customer_invoices!inner(business_id)').eq('customer_invoices.business_id', businessId)
    .gte('paid_at', startDate).lte('paid_at', endDate)
  const customerInvoiceInflow = sum((invoicePayments ?? []).map((p: any) => p.amount))

  const { data: expenses } = await admin.from('expenses').select('gross_amount').eq('business_id', businessId).eq('status', 'CONFIRMED').gte('expense_date', startDate).lte('expense_date', endDate)
  const expenseOutflow = sum((expenses ?? []).map((e: any) => e.gross_amount))

  const { data: supplierPayments } = await admin.from('supplier_invoice_payments')
    .select('amount, supplier_invoices!inner(business_id)').eq('supplier_invoices.business_id', businessId)
    .gte('paid_at', startDate).lte('paid_at', endDate)
  const supplierOutflow = sum((supplierPayments ?? []).map((p: any) => p.amount))

  const inflow = round2(sales.net_revenue + customerInvoiceInflow)
  const outflow = round2(expenseOutflow + supplierOutflow)
  return {
    period: { start: startDate, end: endDate },
    inflow, outflow, net_cash_flow: round2(inflow - outflow),
    inflow_breakdown: { sales: sales.net_revenue, customer_invoice_payments: customerInvoiceInflow },
    outflow_breakdown: { expenses: expenseOutflow, supplier_invoice_payments: supplierOutflow },
  }
}
