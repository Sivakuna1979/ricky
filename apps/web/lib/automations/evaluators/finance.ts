// @ts-nocheck
// H66 — reuses Phase D's automation engine exactly (claimRun/notify/
// completeRun), the same idempotency and settings-resolution pattern
// every other evaluator uses. Finance review items themselves are
// created synchronously where the underlying fact is recorded (see
// lib/finance/review.ts's callers) — these evaluators are what actually
// tells a person about them, on a schedule, rather than requiring
// someone to remember to check the queue.
import { claimRun, completeRun, notify } from '../engine'
import { getResolvedSettings } from '../settings'
import { getRecipients } from '../recipients'
import { todayDateInTimezone } from '../timezone'
import { getSalesSummary } from '@/lib/finance/revenue'
import { getExpenseSummary } from '@/lib/finance/expenses'
import { getCogsSummary } from '@/lib/finance/cogs'
import { round2 } from '@/lib/finance/money'

const THRESHOLDS = [7, 1]

function daysUntil(date: string, today: string): number {
  return Math.round((new Date(date).getTime() - new Date(today).getTime()) / 86400000)
}

// H30/H66 — supplier invoice due/overdue reminders. Exact-day threshold
// matching (not "<="), the same pattern as Phase D's vehicle reminders,
// is what prevents the same invoice firing more than once for the same
// threshold.
export async function runInvoiceDueReminders(admin: any, business: { id: string; timezone: string; name: string }) {
  const settings = await getResolvedSettings(admin, business.id)
  if (!settings.invoice_due_reminder.enabled) return
  const date = todayDateInTimezone(business.timezone)

  const { data: invoices } = await admin.from('supplier_invoices').select('id, invoice_number, due_date, gross_amount, supplier_records(supplier_name)').eq('business_id', business.id).in('status', ['UNPAID', 'PARTIALLY_PAID']).not('due_date', 'is', null)
  for (const inv of invoices ?? []) {
    const days = daysUntil(inv.due_date, date)
    const isOverdue = days < 0
    if (!isOverdue && !THRESHOLDS.includes(days)) continue

    const bucket = isOverdue ? 'overdue' : String(days)
    const runId = await claimRun(admin, business.id, 'invoice_due_reminder', `invoice_due_reminder:${inv.id}:${bucket}:${date}`)
    if (!runId) continue

    const recipients = await getRecipients(admin, business.id, 'view_expenses')
    const supplierName = inv.supplier_records?.supplier_name ?? 'Supplier'
    const body = isOverdue
      ? `${supplierName}'s invoice ${inv.invoice_number ?? ''} (£${inv.gross_amount.toFixed(2)}) is overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}.`
      : `${supplierName}'s invoice ${inv.invoice_number ?? ''} (£${inv.gross_amount.toFixed(2)}) is due in ${days} day${days === 1 ? '' : 's'}.`
    const result = await notify(admin, {
      businessId: business.id, automationType: 'invoice_due_reminder', recipients,
      title: `📋 ${supplierName} — invoice ${isOverdue ? 'overdue' : `due in ${days}d`}`,
      body, category: 'reports', priority: isOverdue ? 'IMPORTANT' : 'ACTION', actionUrl: '/dashboard/finance',
    })
    await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'notified', result })
  }
}

// H54/H66 — one daily digest of the whole open review queue, not one
// notification per item (that would spam for a business with several
// small variances).
export async function runFinanceReviewDigest(admin: any, business: { id: string; timezone: string; name: string }) {
  const settings = await getResolvedSettings(admin, business.id)
  if (!settings.finance_review_digest.enabled) return
  const date = todayDateInTimezone(business.timezone)
  const runId = await claimRun(admin, business.id, 'finance_review_digest', `finance_review_digest:${business.id}:${date}`)
  if (!runId) return

  try {
    const { data: items } = await admin.from('finance_review_items').select('item_type').eq('business_id', business.id).eq('status', 'OPEN')
    if (!items?.length) { await completeRun(admin, runId, { status: 'SKIPPED', actionTaken: 'no_open_items' }); return }

    const tally: Record<string, number> = {}
    for (const i of items) tally[i.item_type] = (tally[i.item_type] ?? 0) + 1
    const lines = Object.entries(tally).map(([type, count]) => `• ${count} ${type.replace(/_/g, ' ')}`)
    const recipients = await getRecipients(admin, business.id, 'view_finance_summary')
    const result = await notify(admin, {
      businessId: business.id, automationType: 'finance_review_digest', recipients,
      title: `🔍 ${items.length} finance item${items.length === 1 ? '' : 's'} to review`, body: lines.join('\n'),
      category: 'reports', priority: 'ACTION', actionUrl: '/dashboard/finance',
    })
    await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'notified', result: { ...result, tally } })
  } catch (e: any) {
    await completeRun(admin, runId, { status: 'FAILED', failureReason: e.message ?? 'unknown_error' })
  }
}

// H37/H66 — a monthly nudge to review last month's recorded VAT, only
// for businesses that have marked themselves VAT-registered (never
// assumed).
export async function runVatPeriodReminder(admin: any, business: { id: string; timezone: string; name: string }) {
  const settings = await getResolvedSettings(admin, business.id)
  if (!settings.vat_period_reminder.enabled) return
  const today = todayDateInTimezone(business.timezone)
  if (!today.endsWith('-01')) return // fires once, on the 1st of the month

  const { data: vat } = await admin.from('vat_settings').select('is_registered').eq('business_id', business.id).maybeSingle()
  if (!vat?.is_registered) return

  const monthKey = today.slice(0, 7)
  const runId = await claimRun(admin, business.id, 'vat_period_reminder', `vat_period_reminder:${business.id}:${monthKey}`)
  if (!runId) return

  const recipients = await getRecipients(admin, business.id, 'view_vat')
  const result = await notify(admin, {
    businessId: business.id, automationType: 'vat_period_reminder', recipients,
    title: `🧾 Review last month's VAT — ${business.name}`,
    body: "Last month's recorded output/input VAT is ready to review in Finance → VAT. This is a FoodTaxi record summary, not a filed return.",
    category: 'reports', priority: 'INFO', actionUrl: '/dashboard/finance',
  })
  await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'notified', result })
}

// H66 — optional (default OFF, same convention as end_of_day_summary).
export async function runDailyFinanceSummary(admin: any, business: { id: string; timezone: string; name: string }) {
  const settings = await getResolvedSettings(admin, business.id)
  if (!settings.daily_finance_summary.enabled) return
  const hour = settings.daily_finance_summary.config?.hour ?? 21
  const minute = settings.daily_finance_summary.config?.minute ?? 0
  const { isDueNow } = await import('../timezone')
  if (!isDueNow(business.timezone, hour, minute)) return

  const date = todayDateInTimezone(business.timezone)
  const runId = await claimRun(admin, business.id, 'daily_finance_summary', `daily_finance_summary:${business.id}:${date}`)
  if (!runId) return

  try {
    const { data: vans } = await admin.from('vans').select('id').eq('business_id', business.id)
    const vanIds = (vans ?? []).map((v: any) => v.id)
    const startIso = `${date}T00:00:00.000Z`
    const endIso = new Date(new Date(`${date}T00:00:00Z`).getTime() + 86400000).toISOString()

    const [sales, expenses, cogs] = await Promise.all([
      getSalesSummary(admin, business.id, { vanIds, startIso, endIso }),
      getExpenseSummary(admin, business.id, { startDate: date, endDate: date }),
      getCogsSummary(admin, business.id, { vanIds, startIso, endIso, startDate: date, endDate: date }),
    ])

    const lines = [
      `💰 Net revenue: £${sales.net_revenue.toFixed(2)}`,
      `📦 Expenses: £${expenses.total_gross.toFixed(2)}`,
      `📊 Gross contribution: £${cogs.gross_contribution.toFixed(2)} (${cogs.coverage_pct}% cost coverage)`,
    ]
    const recipients = await getRecipients(admin, business.id, 'view_finance_summary')
    const result = await notify(admin, {
      businessId: business.id, automationType: 'daily_finance_summary', recipients,
      title: `💰 Finance summary — ${business.name}`, body: lines.join('\n'),
      category: 'reports', priority: 'INFO', actionUrl: '/dashboard/finance',
    })
    await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'notified', result: { ...result, sales, expenses, cogs: round2(cogs.gross_contribution) } })
  } catch (e: any) {
    await completeRun(admin, runId, { status: 'FAILED', failureReason: e.message ?? 'unknown_error' })
  }
}
