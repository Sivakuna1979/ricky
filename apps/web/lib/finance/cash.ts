// @ts-nocheck
// H16–H18 — cash reconciliation math. The formula is exactly the one the
// prompt specifies:
//   OPENING FLOAT + CASH SALES − CASH REFUNDS − RECORDED CASH EXPENSES = EXPECTED CASH
//   ACTUAL CASH − EXPECTED CASH = VARIANCE
// Figures are computed once at count time and stored on the
// cash_reconciliations row as a snapshot (see the migration comment) —
// this module is called once, at creation, not re-run live afterwards.
import { round2 } from './money'
import { getCashFigures } from './revenue'
import { getRecordedCashExpenses } from './expenses'

export const UK_DENOMINATIONS = [50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01]

export function totalFromDenominations(counts: Record<string, number>): number {
  let total = 0
  for (const denom of UK_DENOMINATIONS) {
    const key = String(denom)
    const n = Number(counts[key] ?? 0)
    if (n > 0) total += denom * n
  }
  return round2(total)
}

export async function computeExpectedCash(admin: any, businessId: string, vanId: string, serviceDate: string, openingFloat: number) {
  const { cashSales, cashRefunds } = await getCashFigures(admin, businessId, vanId, serviceDate)
  const recordedCashExpenses = await getRecordedCashExpenses(admin, businessId, vanId, serviceDate)
  const expectedCash = round2((openingFloat ?? 0) + cashSales - cashRefunds - recordedCashExpenses)
  return { cashSalesRecorded: cashSales, cashRefundsRecorded: cashRefunds, recordedCashExpenses, expectedCash }
}
