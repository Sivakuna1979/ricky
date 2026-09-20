// @ts-nocheck
// H46–H53 — Accountant Export centre. CSV only (H46 — "XLSX only if
// useful/maintainable"; a plain accountant-friendly CSV per type covers
// every named use case without adding a spreadsheet-writing dependency).
// Rows carry useful references (order number, invoice number, van name)
// and deliberately exclude customer PII beyond what's needed — sales
// rows never include guest_name/guest_email/guest_phone (H51).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { allowedVanIds } from '@/lib/ai/context'
import { paymentCategory, REVENUE_EXCLUDED_STATUSES } from '@/lib/finance/revenue'
import { getCogsSummary } from '@/lib/finance/cogs'

function toCsv(rows: any[], columns: string[]) {
  const escape = (v: any) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [columns.join(',')]
  for (const row of rows) lines.push(columns.map(c => escape(row[c])).join(','))
  return lines.join('\n')
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` } })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'export_finance')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  if (!type || !start || !end) return NextResponse.json({ error: 'type, start and end are required (custom date range / accounting year)' }, { status: 400 })
  const startIso = `${start}T00:00:00.000Z`
  const endIso = new Date(new Date(`${end}T00:00:00Z`).getTime() + 86400000).toISOString()

  const admin = await createAdminClient()

  if (type === 'sales') {
    const vanIds = await allowedVanIds(admin, ctx)
    const { data: orders } = vanIds.length
      ? await admin.from('orders').select('order_number, van_id, vans(name), total, vat_amount, status, payment_method, source, service_date, created_at').in('van_id', vanIds).gte('created_at', startIso).lt('created_at', endIso)
      : { data: [] }
    const rows = (orders ?? []).filter((o: any) => !REVENUE_EXCLUDED_STATUSES.includes(o.status)).map((o: any) => ({
      order_number: o.order_number, date: o.created_at?.slice(0, 10), van: o.vans?.name, payment_category: paymentCategory(o),
      source: o.source, net: (o.total - (o.vat_amount ?? 0)).toFixed(2), vat: (o.vat_amount ?? 0).toFixed(2), gross: o.total,
    }))
    return csvResponse(toCsv(rows, ['order_number', 'date', 'van', 'payment_category', 'source', 'net', 'vat', 'gross']), `sales_${start}_${end}.csv`)
  }

  if (type === 'expenses') {
    const [{ data }, { data: mappings }] = await Promise.all([
      admin.from('expenses').select('expense_date, description, category, supplier_records(supplier_name), van_id, vans(name), net_amount, vat_amount, gross_amount, payment_method, reference')
        .eq('business_id', ctx.businessId).eq('status', 'CONFIRMED').gte('expense_date', start).lte('expense_date', end),
      admin.from('finance_account_mappings').select('category, account_code, account_name').eq('business_id', ctx.businessId),
    ])
    const accountByCategory: Record<string, string> = Object.fromEntries((mappings ?? []).map((m: any) => [m.category, [m.account_code, m.account_name].filter(Boolean).join(' ')]))
    const rows = (data ?? []).map((e: any) => ({ date: e.expense_date, description: e.description, category: e.category, mapped_account: accountByCategory[e.category] ?? '', supplier: e.supplier_records?.supplier_name, van: e.vans?.name, net: e.net_amount, vat: e.vat_amount, gross: e.gross_amount, payment_method: e.payment_method, reference: e.reference }))
    return csvResponse(toCsv(rows, ['date', 'description', 'category', 'mapped_account', 'supplier', 'van', 'net', 'vat', 'gross', 'payment_method', 'reference']), `expenses_${start}_${end}.csv`)
  }

  if (type === 'supplier_invoices') {
    const { data } = await admin.from('supplier_invoices').select('invoice_number, invoice_date, due_date, supplier_records(supplier_name), net_amount, vat_amount, gross_amount, status')
      .eq('business_id', ctx.businessId).gte('invoice_date', start).lte('invoice_date', end)
    const rows = (data ?? []).map((i: any) => ({ invoice_number: i.invoice_number, date: i.invoice_date, due_date: i.due_date, supplier: i.supplier_records?.supplier_name, net: i.net_amount, vat: i.vat_amount, gross: i.gross_amount, status: i.status }))
    return csvResponse(toCsv(rows, ['invoice_number', 'date', 'due_date', 'supplier', 'net', 'vat', 'gross', 'status']), `supplier_invoices_${start}_${end}.csv`)
  }

  if (type === 'payments') {
    const [{ data: sp }, { data: cp }] = await Promise.all([
      admin.from('supplier_invoice_payments').select('paid_at, amount, payment_method, reference, supplier_invoices!inner(business_id, invoice_number)').eq('supplier_invoices.business_id', ctx.businessId).gte('paid_at', start).lte('paid_at', end),
      admin.from('customer_invoice_payments').select('paid_at, amount, method, reference, customer_invoices!inner(business_id, invoice_number)').eq('customer_invoices.business_id', ctx.businessId).gte('paid_at', start).lte('paid_at', end),
    ])
    const rows = [
      ...(sp ?? []).map((p: any) => ({ date: p.paid_at, direction: 'paid_to_supplier', reference: p.supplier_invoices?.invoice_number, amount: p.amount, method: p.payment_method })),
      ...(cp ?? []).map((p: any) => ({ date: p.paid_at, direction: 'received_from_customer', reference: p.customer_invoices?.invoice_number, amount: p.amount, method: p.method })),
    ]
    return csvResponse(toCsv(rows, ['date', 'direction', 'reference', 'amount', 'method']), `payments_${start}_${end}.csv`)
  }

  if (type === 'refunds') {
    const { data } = await admin.from('refunds').select('refunded_at, amount, reason, method, orders(order_number)').eq('business_id', ctx.businessId).gte('refunded_at', startIso).lt('refunded_at', endIso)
    const rows = (data ?? []).map((r: any) => ({ date: r.refunded_at?.slice(0, 10), order_number: r.orders?.order_number, amount: r.amount, reason: r.reason, method: r.method }))
    return csvResponse(toCsv(rows, ['date', 'order_number', 'amount', 'reason', 'method']), `refunds_${start}_${end}.csv`)
  }

  if (type === 'cash') {
    const { data } = await admin.from('cash_reconciliations').select('service_date, vans(name), opening_float, cash_sales_recorded, cash_refunds_recorded, recorded_cash_expenses, expected_cash, actual_cash, variance')
      .eq('business_id', ctx.businessId).gte('service_date', start).lte('service_date', end)
    const rows = (data ?? []).map((c: any) => ({ date: c.service_date, van: c.vans?.name, opening_float: c.opening_float, cash_sales: c.cash_sales_recorded, cash_refunds: c.cash_refunds_recorded, cash_expenses: c.recorded_cash_expenses, expected: c.expected_cash, actual: c.actual_cash, variance: c.variance }))
    return csvResponse(toCsv(rows, ['date', 'van', 'opening_float', 'cash_sales', 'cash_refunds', 'cash_expenses', 'expected', 'actual', 'variance']), `cash_reconciliation_${start}_${end}.csv`)
  }

  if (type === 'vat') {
    const { getVatSummary } = await import('@/lib/finance/vat')
    const vanIds = await allowedVanIds(admin, ctx)
    const summary = await getVatSummary(admin, ctx.businessId, { vanIds, startIso, endIso, startDate: start, endDate: end })
    const rows = [{ period: `${start} to ${end}`, output_vat: summary.output_vat, input_vat: summary.input_vat, difference: summary.difference, label: summary.label }]
    return csvResponse(toCsv(rows, ['period', 'output_vat', 'input_vat', 'difference', 'label']), `vat_summary_${start}_${end}.csv`)
  }

  if (type === 'cogs') {
    const vanIds = await allowedVanIds(admin, ctx)
    const summary = await getCogsSummary(admin, ctx.businessId, { vanIds, startIso, endIso, startDate: start, endDate: end })
    const rows = [{ period: `${start} to ${end}`, total_revenue: summary.total_revenue, known_cogs: summary.known_cogs, gross_contribution: summary.gross_contribution, coverage_pct: summary.coverage_pct }]
    return csvResponse(toCsv(rows, ['period', 'total_revenue', 'known_cogs', 'gross_contribution', 'coverage_pct']), `cogs_summary_${start}_${end}.csv`)
  }

  return NextResponse.json({ error: 'Unknown export type' }, { status: 400 })
}
