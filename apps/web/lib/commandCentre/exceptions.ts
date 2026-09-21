// @ts-nocheck
// K13/K14 — deterministic exception detection. Every function here reads
// straight from the same source-of-truth tables the rest of the app
// already uses (never a cache) and returns a LiveIssue-shaped record with
// a stable dedupe_key, a rule-derived priority, and the measurable facts
// that justify it — an anomaly is a signal, never an invented cause
// (K14): nothing here writes an explanation beyond what the numbers show.
import { round2 } from '@/lib/finance/money'
import { getAnomalies } from '@/lib/routes/analytics'
import type { Priority } from './priority'

export type Exception = {
  dedupeKey: string
  category: string
  priority: Priority
  vanId?: string | null
  title: string
  detail: string
  evidence: Record<string, any>
  actionUrl: string
}

// K13 — low/out-of-stock, itemised (the operations-summary tile shows a
// count; this is the same underlying stock_levels/stock_items condition,
// drilled down to which items).
export async function stockExceptions(admin: any, businessId: string): Promise<Exception[]> {
  const { data: items } = await admin.from('stock_items').select('id, name, minimum_quantity').eq('business_id', businessId).eq('active', true)
  if (!items?.length) return []
  const { data: levels } = await admin.from('stock_levels').select('stock_item_id, quantity').in('stock_item_id', items.map((i: any) => i.id))
  const totals: Record<string, number> = {}
  for (const l of levels ?? []) totals[l.stock_item_id] = (totals[l.stock_item_id] ?? 0) + (l.quantity ?? 0)

  const out: Exception[] = []
  for (const item of items) {
    const qty = totals[item.id] ?? 0
    if (qty <= 0) {
      out.push({
        dedupeKey: `out_of_stock:${item.id}`, category: 'stock', priority: 'CRITICAL',
        title: `${item.name} is out of stock`, detail: `Current quantity: ${qty}.`,
        evidence: { stock_item_id: item.id, quantity: qty }, actionUrl: '/dashboard/stock',
      })
    } else if (qty <= item.minimum_quantity) {
      out.push({
        dedupeKey: `low_stock:${item.id}`, category: 'stock', priority: 'ACTION',
        title: `${item.name} is low on stock`, detail: `Current quantity ${qty}, minimum ${item.minimum_quantity}.`,
        evidence: { stock_item_id: item.id, quantity: qty, minimum_quantity: item.minimum_quantity }, actionUrl: '/dashboard/stock',
      })
    }
  }
  return out
}

// K13 — repeated stockout: the same item has gone out-of-stock more than
// once in the trailing 14 days, evidenced by counting distinct days it
// crossed to zero via stock_movements (never inferred from a single snapshot).
export async function repeatedStockoutExceptions(admin: any, businessId: string): Promise<Exception[]> {
  const since = new Date(Date.now() - 14 * 86400000).toISOString()
  const { data: movements } = await admin.from('stock_movements').select('stock_item_id, new_quantity, created_at, stock_items!inner(name, business_id)')
    .eq('stock_items.business_id', businessId).lte('new_quantity', 0).gte('created_at', since)
  if (!movements?.length) return []
  const daysByItem: Record<string, Set<string>> = {}
  const nameByItem: Record<string, string> = {}
  for (const m of movements) {
    daysByItem[m.stock_item_id] ??= new Set()
    daysByItem[m.stock_item_id].add(m.created_at.slice(0, 10))
    nameByItem[m.stock_item_id] = m.stock_items?.name
  }
  const out: Exception[] = []
  for (const [itemId, days] of Object.entries(daysByItem)) {
    if (days.size >= 2) {
      out.push({
        dedupeKey: `repeated_stockout:${itemId}`, category: 'stock', priority: 'IMPORTANT',
        title: `${nameByItem[itemId]} has run out repeatedly`, detail: `Out of stock on ${days.size} separate days in the last 14 days.`,
        evidence: { stock_item_id: itemId, days_out: [...days].sort() }, actionUrl: '/dashboard/stock',
      })
    }
  }
  return out
}

// K13 — hygiene: no opening checklist recorded yet today for a trading van.
export async function hygieneExceptions(admin: any, businessId: string, vanIds: string[], todayStart: string): Promise<Exception[]> {
  if (!vanIds.length) return []
  const { data: checklists } = await admin.from('hygiene_logs').select('van_id').eq('log_type', 'opening_checklist').gte('recorded_at', todayStart).in('van_id', vanIds)
  const done = new Set((checklists ?? []).map((c: any) => c.van_id))
  const { data: vans } = await admin.from('vans').select('id, name').in('id', vanIds).eq('is_active', true)
  return (vans ?? []).filter((v: any) => !done.has(v.id)).map((v: any) => ({
    dedupeKey: `hygiene_miss:${v.id}:${todayStart.slice(0, 10)}`, category: 'hygiene', priority: 'ACTION',
    title: `${v.name}: opening checklist not recorded today`, detail: 'No opening_checklist hygiene log found for today.',
    evidence: { van_id: v.id, date: todayStart.slice(0, 10) }, actionUrl: '/dashboard/hygiene',
  }))
}

// K13 — vehicle/insurance/MOT/service expiring or overdue.
export async function vehicleExceptions(admin: any, businessId: string, windowDays = 30): Promise<Exception[]> {
  const { data: vehicles } = await admin.from('vehicle_details').select('van_id, mot_expiry, insurance_expiry, tax_expiry, service_due_date, vans(name)').eq('business_id', businessId)
  if (!vehicles?.length) return []
  const today = new Date().toISOString().slice(0, 10)
  const cutoff = new Date(Date.now() + windowDays * 86400000).toISOString().slice(0, 10)
  const out: Exception[] = []
  for (const v of vehicles) {
    for (const field of ['mot_expiry', 'insurance_expiry', 'tax_expiry', 'service_due_date']) {
      const date = v[field]
      if (!date || date > cutoff) continue
      const overdue = date < today
      out.push({
        dedupeKey: `vehicle_expiry:${v.van_id}:${field}`, category: 'vehicle', priority: overdue ? 'CRITICAL' : 'ACTION', vanId: v.van_id,
        title: `${v.vans?.name ?? 'Vehicle'}: ${field.replace('_', ' ')} ${overdue ? 'overdue' : 'due soon'}`,
        detail: `${field.replace('_', ' ')} date: ${date}.`,
        evidence: { van_id: v.van_id, field, date, overdue }, actionUrl: '/dashboard/fleet',
      })
    }
  }
  return out
}

// K13 — a staff member clocked in but never clocked out on a past shift.
export async function staffExceptions(admin: any, businessId: string): Promise<Exception[]> {
  const since = new Date(Date.now() - 3 * 86400000).toISOString()
  const { data: openEntries } = await admin.from('time_entries')
    .select('id, staff_id, clock_in_at, van_id, staff(id, users(full_name))')
    .eq('business_id', businessId).is('clock_out_at', null).gte('clock_in_at', since).lt('clock_in_at', new Date(Date.now() - 8 * 3600000).toISOString())
  return (openEntries ?? []).map((e: any) => ({
    dedupeKey: `missing_clockout:${e.id}`, category: 'staff', priority: 'ACTION', vanId: e.van_id ?? null,
    title: `${e.staff?.users?.full_name ?? 'A staff member'} never clocked out`, detail: `Clocked in ${e.clock_in_at}, no clock-out recorded since.`,
    evidence: { time_entry_id: e.id, staff_id: e.staff_id, clock_in_at: e.clock_in_at }, actionUrl: '/dashboard/team',
  }))
}

// K13 — overdue supplier invoices (Phase H's own status/due_date).
export async function financeExceptions(admin: any, businessId: string): Promise<Exception[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data: invoices } = await admin.from('supplier_invoices')
    .select('id, invoice_number, due_date, gross_amount, status, supplier_records(name)')
    .eq('business_id', businessId).in('status', ['UNPAID', 'PARTIALLY_PAID']).lt('due_date', today)
  const out: Exception[] = (invoices ?? []).map((inv: any) => ({
    dedupeKey: `overdue_invoice:${inv.id}`, category: 'finance', priority: 'IMPORTANT',
    title: `Overdue invoice from ${inv.supplier_records?.name ?? 'a supplier'}`, detail: `£${inv.gross_amount} due ${inv.due_date}${inv.invoice_number ? ` (#${inv.invoice_number})` : ''}.`,
    evidence: { supplier_invoice_id: inv.id, due_date: inv.due_date, amount: inv.gross_amount }, actionUrl: '/dashboard/finance',
  }))

  // Cash/card variance — a meaningful mismatch (>£5 or >3% of expected),
  // flagged the day it was recorded.
  const since = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)
  const [{ data: cash }, { data: card }] = await Promise.all([
    admin.from('cash_reconciliations').select('id, van_id, service_date, variance, expected_cash, vans(name)').eq('business_id', businessId).gte('service_date', since),
    admin.from('card_reconciliations').select('id, van_id, service_date, variance, foodtaxi_card_recorded_total, vans(name)').eq('business_id', businessId).gte('service_date', since),
  ])
  for (const c of cash ?? []) {
    const pct = c.expected_cash ? Math.abs(c.variance / c.expected_cash) * 100 : 0
    if (Math.abs(c.variance) > 5 || pct > 3) {
      out.push({
        dedupeKey: `cash_variance:${c.id}`, category: 'finance', priority: Math.abs(c.variance) > 20 ? 'IMPORTANT' : 'ACTION', vanId: c.van_id,
        title: `${c.vans?.name ?? 'A van'}: cash variance of £${round2(c.variance)}`, detail: `Recorded on ${c.service_date}, expected £${c.expected_cash}.`,
        evidence: { cash_reconciliation_id: c.id, variance: c.variance }, actionUrl: '/dashboard/finance',
      })
    }
  }
  for (const c of card ?? []) {
    if (c.variance != null && Math.abs(c.variance) > 5) {
      out.push({
        dedupeKey: `card_variance:${c.id}`, category: 'finance', priority: 'ACTION', vanId: c.van_id,
        title: `${c.vans?.name ?? 'A van'}: card variance of £${round2(c.variance)}`, detail: `Recorded on ${c.service_date}.`,
        evidence: { card_reconciliation_id: c.id, variance: c.variance }, actionUrl: '/dashboard/finance',
      })
    }
  }
  return out
}

// K13 — high wastage day: a single day's recorded wastage cost for a van
// exceeds 2x its trailing-14-day average (excluding that day itself).
export async function wastageExceptions(admin: any, businessId: string, vanIds: string[]): Promise<Exception[]> {
  if (!vanIds.length) return []
  const since = new Date(Date.now() - 14 * 86400000).toISOString()
  const { data: records } = await admin.from('wastage_records').select('cost, created_at, location_id, stock_locations!inner(van_id, vans(name))').eq('business_id', businessId).gte('created_at', since)
  if (!records?.length) return []
  const byVanDay: Record<string, Record<string, number>> = {}
  const nameByVan: Record<string, string> = {}
  for (const r of records) {
    const vanId = r.stock_locations?.van_id
    if (!vanId || !vanIds.includes(vanId)) continue
    nameByVan[vanId] = r.stock_locations?.vans?.name
    const day = r.created_at.slice(0, 10)
    byVanDay[vanId] ??= {}
    byVanDay[vanId][day] = round2((byVanDay[vanId][day] ?? 0) + (r.cost ?? 0))
  }
  const today = new Date().toISOString().slice(0, 10)
  const out: Exception[] = []
  for (const [vanId, byDay] of Object.entries(byVanDay)) {
    const todayCost = byDay[today] ?? 0
    if (!todayCost) continue
    const otherDays = Object.entries(byDay).filter(([d]) => d !== today)
    if (otherDays.length < 3) continue
    const avg = otherDays.reduce((s, [, v]) => s + v, 0) / otherDays.length
    if (avg > 0 && todayCost > avg * 2) {
      out.push({
        dedupeKey: `high_wastage:${vanId}:${today}`, category: 'stock', priority: 'ACTION',
        title: `${nameByVan[vanId]}: unusually high wastage today`, detail: `£${todayCost} today vs a ${otherDays.length}-day average of £${round2(avg)}.`,
        evidence: { van_id: vanId, today_cost: todayCost, average_cost: round2(avg), comparable_days: otherDays.length }, actionUrl: '/dashboard/stock',
      })
    }
  }
  return out
}

// K13 — route below baseline: yesterday's revenue for a van was
// materially below its own same-weekday average (reuses Phase G's own
// getAnomalies() rather than re-deriving the comparison).
export async function routeExceptions(admin: any, businessId: string, vanIds: string[]): Promise<Exception[]> {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const out: Exception[] = []
  for (const vanId of vanIds) {
    const anomaly = await getAnomalies(admin, businessId, vanId, yesterday)
    if (anomaly.has_data && anomaly.is_notable && anomaly.revenue_percent_difference < -20) {
      out.push({
        dedupeKey: `route_below_baseline:${vanId}:${yesterday}`, category: 'route', priority: 'IMPORTANT',
        title: `Van's route was ${Math.abs(anomaly.revenue_percent_difference)}% below its normal ${yesterday}`,
        detail: `Revenue £${anomaly.revenue} vs a ${anomaly.comparable_days}-day same-weekday average of £${anomaly.average_revenue_same_weekday}.`,
        evidence: anomaly, vanId, actionUrl: '/dashboard/routes',
      })
    }
  }
  return out
}

// L47 — integration-health exceptions: connection errors and open
// reconciliation/sync-review items. No opaque health score (K7) — just the
// real counts and connection statuses, same as every other category here.
export async function integrationExceptions(admin: any, businessId: string): Promise<Exception[]> {
  const out: Exception[] = []
  const [{ data: connections }, { count: needsReview }, { count: openReview }] = await Promise.all([
    admin.from('accounting_connections').select('id, provider, status, last_error').eq('business_id', businessId).in('status', ['ERROR', 'ACTION_REQUIRED']),
    admin.from('accounting_sync_jobs').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'NEEDS_REVIEW'),
    admin.from('reconciliation_review_items').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'OPEN'),
  ])
  for (const c of connections ?? []) {
    out.push({
      dedupeKey: `integration_connection:${c.id}`, category: 'integrations', priority: c.status === 'ERROR' ? 'IMPORTANT' : 'ACTION',
      title: `${c.provider === 'XERO' ? 'Xero' : 'QuickBooks'} needs attention`, detail: c.last_error ?? `Connection status: ${c.status}.`,
      evidence: { connection_id: c.id, status: c.status }, actionUrl: '/dashboard/integrations',
    })
  }
  if (needsReview) {
    out.push({
      dedupeKey: `integration_sync_needs_review:${businessId}`, category: 'integrations', priority: 'ACTION',
      title: `${needsReview} accounting sync job${needsReview === 1 ? '' : 's'} need review`, detail: 'Stuck after repeated automatic retries.',
      evidence: { needs_review_count: needsReview }, actionUrl: '/dashboard/integrations',
    })
  }
  if (openReview) {
    out.push({
      dedupeKey: `integration_reconciliation_open:${businessId}`, category: 'integrations', priority: 'ACTION',
      title: `${openReview} reconciliation item${openReview === 1 ? '' : 's'} open`, detail: 'Unmatched or mismatched payment/provider records awaiting review.',
      evidence: { open_review_count: openReview }, actionUrl: '/dashboard/integrations',
    })
  }
  return out
}

export async function computeAllExceptions(admin: any, businessId: string, vanIds: string[], todayStart: string): Promise<Exception[]> {
  const [stock, repeated, hygiene, vehicle, staff, finance, wastage, route, integrations] = await Promise.all([
    stockExceptions(admin, businessId),
    repeatedStockoutExceptions(admin, businessId),
    hygieneExceptions(admin, businessId, vanIds, todayStart),
    vehicleExceptions(admin, businessId),
    staffExceptions(admin, businessId),
    financeExceptions(admin, businessId),
    wastageExceptions(admin, businessId, vanIds),
    routeExceptions(admin, businessId, vanIds),
    integrationExceptions(admin, businessId),
  ])
  return [...stock, ...repeated, ...hygiene, ...vehicle, ...staff, ...finance, ...wastage, ...route, ...integrations]
}
