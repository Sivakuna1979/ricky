// @ts-nocheck
// H8–H11 — expense aggregation. CRUD itself lives in the API routes
// (app/api/finance/expenses); this file holds the summary/rollup logic
// shared by the dashboard, reports and AI tools.
import { round2, sum } from './money'

export async function getExpenseSummary(admin: any, businessId: string, opts: { startDate: string; endDate: string; vanId?: string }) {
  let query = admin.from('expenses').select('id, category, net_amount, vat_amount, gross_amount, van_id, payment_method, expense_date')
    .eq('business_id', businessId).eq('status', 'CONFIRMED')
    .gte('expense_date', opts.startDate).lte('expense_date', opts.endDate)
  if (opts.vanId) query = query.eq('van_id', opts.vanId)
  const { data, error } = await query
  if (error) throw new Error('expenses_query_failed')
  const rows = data ?? []

  const byCategory: Record<string, { net: number; vat: number; gross: number; count: number }> = {}
  for (const e of rows) {
    byCategory[e.category] ??= { net: 0, vat: 0, gross: 0, count: 0 }
    byCategory[e.category].net += e.net_amount ?? 0
    byCategory[e.category].vat += e.vat_amount ?? 0
    byCategory[e.category].gross += e.gross_amount ?? 0
    byCategory[e.category].count += 1
  }
  for (const c of Object.keys(byCategory)) {
    byCategory[c].net = round2(byCategory[c].net)
    byCategory[c].vat = round2(byCategory[c].vat)
    byCategory[c].gross = round2(byCategory[c].gross)
  }

  return {
    total_net: sum(rows.map((e: any) => e.net_amount)),
    total_vat: sum(rows.map((e: any) => e.vat_amount)),
    total_gross: sum(rows.map((e: any) => e.gross_amount)),
    count: rows.length,
    by_category: byCategory,
  }
}

// H16 — cash-paid expenses recorded for one van/day, used by cash
// reconciliation's expected-cash formula.
export async function getRecordedCashExpenses(admin: any, businessId: string, vanId: string, serviceDate: string) {
  const { data } = await admin.from('expenses').select('gross_amount')
    .eq('business_id', businessId).eq('van_id', vanId).eq('expense_date', serviceDate)
    .eq('payment_method', 'cash').eq('status', 'CONFIRMED')
  return sum((data ?? []).map((e: any) => e.gross_amount))
}

// H54 — a crude but explicit duplicate check: same supplier, same date,
// same gross amount, already CONFIRMED. Flags for review — never
// auto-deletes or auto-merges (H54 explicitly forbids that).
export async function findPossibleDuplicateExpense(admin: any, businessId: string, candidate: { supplier_id: string | null; expense_date: string; gross_amount: number }) {
  if (!candidate.supplier_id) return null
  const { data } = await admin.from('expenses').select('id, expense_date, gross_amount, description')
    .eq('business_id', businessId).eq('supplier_id', candidate.supplier_id).eq('expense_date', candidate.expense_date)
    .eq('gross_amount', candidate.gross_amount).eq('status', 'CONFIRMED').limit(1)
  return data?.[0] ?? null
}
