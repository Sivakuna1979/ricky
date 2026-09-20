// @ts-nocheck
// H32–H37 — VAT summary. Recorded-data summary only — explicitly never a
// filed return, never submitted anywhere (H37/H166/final safety check).
// Accrual basis: output VAT is orders.vat_amount for orders in the
// period (by created_at, same window as revenue); input VAT is
// expenses.vat_amount (by expense_date) + supplier_invoices.vat_amount
// (by invoice_date) in the period — invoice/expense date, not payment
// date, is a documented choice (accrual, the common small-business
// default), not cash-basis.
//
// Known limitation, documented rather than silently handled: a refund
// reduces net revenue but refunds carries no VAT split of its own, so
// output VAT here is not reduced for refunded orders. Flagged in the
// summary's `note` so nobody reads this as more precise than it is.
import { round2, sum } from './money'
import { REVENUE_EXCLUDED_STATUSES } from './revenue'

export async function getVatSummary(admin: any, businessId: string, opts: { vanIds: string[]; startIso: string; endIso: string; startDate: string; endDate: string }) {
  const { data: settings } = await admin.from('vat_settings').select('*').eq('business_id', businessId).maybeSingle()

  let outputVat = 0
  if (opts.vanIds.length) {
    const { data: orders } = await admin.from('orders').select('vat_amount, status').in('van_id', opts.vanIds).gte('created_at', opts.startIso).lt('created_at', opts.endIso)
    outputVat = sum((orders ?? []).filter((o: any) => !REVENUE_EXCLUDED_STATUSES.includes(o.status)).map((o: any) => o.vat_amount))
  }

  const { data: expenses } = await admin.from('expenses').select('vat_amount').eq('business_id', businessId).eq('status', 'CONFIRMED').gte('expense_date', opts.startDate).lte('expense_date', opts.endDate)
  const expenseVat = sum((expenses ?? []).map((e: any) => e.vat_amount))

  const { data: invoices } = await admin.from('supplier_invoices').select('vat_amount').eq('business_id', businessId).neq('status', 'VOID').gte('invoice_date', opts.startDate).lte('invoice_date', opts.endDate)
  const invoiceVat = sum((invoices ?? []).map((i: any) => i.vat_amount))

  const inputVat = round2(expenseVat + invoiceVat)
  const difference = round2(outputVat - inputVat)

  return {
    is_registered: settings?.is_registered ?? false,
    vat_number: settings?.vat_number ?? null,
    default_rate: settings?.default_rate ?? 20.00,
    output_vat: outputVat,
    input_vat: inputVat,
    input_vat_from_expenses: expenseVat,
    input_vat_from_supplier_invoices: invoiceVat,
    difference,
    note: 'This is a FoodTaxi record summary for review, not a filed VAT return. Output VAT is not adjusted for refunds, which carry no VAT split of their own.',
    label: difference >= 0 ? 'VAT recorded as owed' : 'VAT recorded as reclaimable',
  }
}
