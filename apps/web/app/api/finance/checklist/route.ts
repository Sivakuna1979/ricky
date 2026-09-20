// @ts-nocheck
// H66/H71 — month-end checklist and completeness indicators (COGS
// coverage, receipt coverage, VAT review count, open review items,
// unpaid invoices). Read-only — this never locks a period itself
// (see /api/finance/periods for that, a separate authorised action).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { allowedVanIds } from '@/lib/ai/context'
import { round2 } from '@/lib/finance/money'
import { getCogsSummary } from '@/lib/finance/cogs'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_finance_summary')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start') ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const end = searchParams.get('end') ?? new Date().toISOString().slice(0, 10)
  const startIso = `${start}T00:00:00.000Z`
  const endIso = new Date(new Date(`${end}T00:00:00Z`).getTime() + 86400000).toISOString()

  const admin = await createAdminClient()
  const vanIds = await allowedVanIds(admin, ctx)

  const [cogs, expenseRows, reviewOpenCount, unpaidInvoices, vatSettings] = await Promise.all([
    getCogsSummary(admin, ctx.businessId, { vanIds, startIso, endIso, startDate: start, endDate: end }),
    admin.from('expenses').select('id, document_id, gross_amount').eq('business_id', ctx.businessId).eq('status', 'CONFIRMED').gte('expense_date', start).lte('expense_date', end),
    admin.from('finance_review_items').select('id', { count: 'exact', head: true }).eq('business_id', ctx.businessId).eq('status', 'OPEN'),
    admin.from('supplier_invoices').select('id', { count: 'exact', head: true }).eq('business_id', ctx.businessId).in('status', ['UNPAID', 'PARTIALLY_PAID']),
    admin.from('vat_settings').select('is_registered').eq('business_id', ctx.businessId).maybeSingle(),
  ])

  const expenses = expenseRows.data ?? []
  const withDocument = expenses.filter((e: any) => e.document_id).length
  const receiptCoveragePct = expenses.length ? round2((withDocument / expenses.length) * 100) : 100

  return NextResponse.json({
    period: { start, end },
    cogs_coverage_pct: cogs.coverage_pct,
    receipt_coverage_pct: receiptCoveragePct,
    expenses_with_receipt: withDocument, expenses_total: expenses.length,
    open_review_items: reviewOpenCount.count ?? 0,
    unpaid_supplier_invoices: unpaidInvoices.count ?? 0,
    vat_registered: vatSettings.data?.is_registered ?? false,
    checklist: [
      { item: 'Review open finance review items', done: (reviewOpenCount.count ?? 0) === 0 },
      { item: 'Chase unpaid supplier invoices', done: (unpaidInvoices.count ?? 0) === 0 },
      { item: 'Receipts attached to expenses', done: receiptCoveragePct >= 90 },
      { item: 'Known cost coverage for sales', done: cogs.coverage_pct >= 80 },
    ],
  })
}
