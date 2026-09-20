// @ts-nocheck
// D16, D17, D18 — daily briefing, end-of-day summary, weekly summary.
// Every number here comes from a real query; nothing is estimated,
// predicted, or AI-generated (explicitly required by the brief).
import { claimRun, completeRun, notify } from '../engine'
import { getResolvedSettings } from '../settings'
import { getRecipients } from '../recipients'
import { nowInTimezone, todayDateInTimezone, isDueNow, isoWeekKey } from '../timezone'

function round2(n: number) { return Math.round((n ?? 0) * 100) / 100 }
const REVENUE_EXCLUDED_STATUSES = ['cancelled'] // same definition as /api/analytics/summary (Phase B)

export async function runDailyBriefing(admin: any, business: { id: string; timezone: string; name: string }) {
  const settings = await getResolvedSettings(admin, business.id)
  if (!settings.daily_briefing.enabled) return
  const hour = settings.daily_briefing.config?.hour ?? 8
  const minute = settings.daily_briefing.config?.minute ?? 0
  if (!isDueNow(business.timezone, hour, minute)) return

  const date = todayDateInTimezone(business.timezone)
  const runId = await claimRun(admin, business.id, 'daily_briefing', `daily_briefing:${business.id}:${date}`)
  if (!runId) return

  try {
    const todayDow = nowInTimezone(business.timezone).weekday
    const dowIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(todayDow)

    const { data: vans } = await admin.from('vans').select('id, name').eq('business_id', business.id).eq('is_active', true)
    const vanIds = (vans ?? []).map((v: any) => v.id)

    const [{ data: scheduledToday }, { data: shiftsToday }, { data: items }, { count: eventCount }] = await Promise.all([
      vanIds.length ? admin.from('van_schedule').select('van_id').in('van_id', vanIds).eq('day_of_week', dowIndex) : { data: [] },
      admin.from('shifts').select('staff_id').eq('business_id', business.id).eq('shift_date', date),
      admin.from('stock_items').select('id, minimum_quantity').eq('business_id', business.id).eq('active', true),
      admin.from('event_requests').select('id', { count: 'exact', head: true }).eq('admin_status', 'new'),
    ])

    const { data: levels } = await admin.from('stock_levels').select('stock_item_id, quantity')
    const totals: Record<string, number> = {}
    for (const l of levels ?? []) totals[l.stock_item_id] = (totals[l.stock_item_id] ?? 0) + (l.quantity ?? 0)
    const lowStockCount = (items ?? []).filter((i: any) => (totals[i.id] ?? 0) <= i.minimum_quantity).length

    const { data: checklistsToday } = vanIds.length
      ? await admin.from('hygiene_logs').select('van_id').eq('log_type', 'opening_checklist').gte('recorded_at', `${date}T00:00:00`).in('van_id', vanIds)
      : { data: [] }
    const hygieneDue = vanIds.length - new Set((checklistsToday ?? []).map((c: any) => c.van_id)).size

    const { data: vehicles } = await admin.from('vehicle_details').select('mot_expiry, insurance_expiry, tax_expiry, service_due_date').eq('business_id', business.id)
    const soonCutoff = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    let vehicleAlerts = 0
    for (const v of vehicles ?? []) for (const f of ['mot_expiry', 'insurance_expiry', 'tax_expiry', 'service_due_date']) if (v[f] && v[f] <= soonCutoff) vehicleAlerts++

    const scheduledVanIds = new Set((scheduledToday ?? []).map((s: any) => s.van_id))
    const vansScheduled = (vans ?? []).filter((v: any) => scheduledVanIds.has(v.id))
    const staffWorking = new Set((shiftsToday ?? []).map((s: any) => s.staff_id)).size

    const lines = [
      `🚐 ${vansScheduled.length} van${vansScheduled.length === 1 ? '' : 's'} scheduled${vansScheduled.length ? ` (${vansScheduled.map((v: any) => v.name).join(', ')})` : ''}`,
      `👥 ${staffWorking} staff working`,
      `📦 ${lowStockCount} low-stock item${lowStockCount === 1 ? '' : 's'}`,
      `🧼 ${hygieneDue} hygiene check${hygieneDue === 1 ? '' : 's'} due`,
      `🔧 ${vehicleAlerts} vehicle reminder${vehicleAlerts === 1 ? '' : 's'}`,
      `🎉 ${eventCount ?? 0} event enquir${(eventCount ?? 0) === 1 ? 'y' : 'ies'} awaiting response`,
    ]
    const body = lines.join('\n')

    const recipients = await getRecipients(admin, business.id, 'view_analytics')
    const result = await notify(admin, {
      businessId: business.id, automationType: 'daily_briefing', recipients,
      title: `☀️ Good morning, ${business.name}`, body, category: 'reports', priority: 'INFO', actionUrl: '/dashboard',
    })
    await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'notified', result: { ...result, lines } })
  } catch (e: any) {
    await completeRun(admin, runId, { status: 'FAILED', failureReason: e.message ?? 'unknown_error' })
  }
}

export async function runEndOfDaySummary(admin: any, business: { id: string; timezone: string; name: string }) {
  const settings = await getResolvedSettings(admin, business.id)
  if (!settings.end_of_day_summary.enabled) return
  const hour = settings.end_of_day_summary.config?.hour ?? 21
  const minute = settings.end_of_day_summary.config?.minute ?? 0
  if (!isDueNow(business.timezone, hour, minute)) return

  const date = todayDateInTimezone(business.timezone)
  const runId = await claimRun(admin, business.id, 'end_of_day_summary', `eod_summary:${business.id}:${date}`)
  if (!runId) return

  try {
    const { data: vans } = await admin.from('vans').select('id').eq('business_id', business.id)
    const vanIds = (vans ?? []).map((v: any) => v.id)
    const { data: orders } = vanIds.length
      ? await admin.from('orders').select('id, total, status, payment_method, source').in('van_id', vanIds).gte('created_at', `${date}T00:00:00`)
      : { data: [] }
    const revenueOrders = (orders ?? []).filter((o: any) => !REVENUE_EXCLUDED_STATUSES.includes(o.status))
    const revenue = round2(revenueOrders.reduce((s: number, o: any) => s + (o.total ?? 0), 0))
    const orderCount = revenueOrders.length
    const aov = orderCount ? round2(revenue / orderCount) : 0

    const orderIds = revenueOrders.map((o: any) => o.id)
    let topItems: any[] = []
    if (orderIds.length) {
      const { data: items } = await admin.from('order_items').select('name, quantity').in('order_id', orderIds.slice(0, 500))
      const tally: Record<string, number> = {}
      for (const it of items ?? []) tally[it.name] = (tally[it.name] ?? 0) + (it.quantity ?? 1)
      topItems = Object.entries(tally).sort((a: any, b: any) => b[1] - a[1]).slice(0, 3)
    }

    const { data: wastage } = await admin.from('wastage_records').select('cost').eq('business_id', business.id).gte('created_at', `${date}T00:00:00`)
    const wastageCost = round2((wastage ?? []).reduce((s: number, w: any) => s + (w.cost ?? 0), 0))

    const { data: entries } = await admin.from('time_entries').select('clock_in_at, clock_out_at').eq('business_id', business.id).gte('clock_in_at', `${date}T00:00:00`)
    const staffMinutes = (entries ?? []).reduce((s: number, e: any) => e.clock_out_at ? s + (new Date(e.clock_out_at).getTime() - new Date(e.clock_in_at).getTime()) / 60000 : s, 0)

    const lines = [
      `💰 Revenue: £${revenue.toFixed(2)}`,
      `📦 Orders: ${orderCount} (avg £${aov.toFixed(2)})`,
      topItems.length ? `🏆 Top sellers: ${topItems.map(([n, q]) => `${n} ×${q}`).join(', ')}` : null,
      `🗑️ Wastage: £${wastageCost.toFixed(2)}`,
      `⏱️ Staff hours: ${round2(staffMinutes / 60)}`,
    ].filter(Boolean)
    const body = lines.join('\n')

    const recipients = await getRecipients(admin, business.id, 'view_analytics')
    const result = await notify(admin, {
      businessId: business.id, automationType: 'end_of_day_summary', recipients,
      title: `🌙 End of day — ${business.name}`, body, category: 'reports', priority: 'INFO', actionUrl: '/dashboard/analytics',
    })
    await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'notified', result: { revenue, orderCount, aov, wastageCost, ...result } })
  } catch (e: any) {
    await completeRun(admin, runId, { status: 'FAILED', failureReason: e.message ?? 'unknown_error' })
  }
}

export async function runWeeklySummary(admin: any, business: { id: string; timezone: string; name: string }) {
  const settings = await getResolvedSettings(admin, business.id)
  if (!settings.weekly_summary.enabled) return
  const targetWeekday = settings.weekly_summary.config?.weekday ?? 'Mon'
  const hour = settings.weekly_summary.config?.hour ?? 8
  const minute = settings.weekly_summary.config?.minute ?? 0
  const now = nowInTimezone(business.timezone)
  if (now.weekday !== targetWeekday || !isDueNow(business.timezone, hour, minute)) return

  const weekKey = isoWeekKey(business.timezone)
  const runId = await claimRun(admin, business.id, 'weekly_summary', `weekly_summary:${business.id}:${weekKey}`)
  if (!runId) return

  try {
    const thisWeekStart = new Date(Date.now() - 7 * 86400000).toISOString()
    const lastWeekStart = new Date(Date.now() - 14 * 86400000).toISOString()

    const { data: vans } = await admin.from('vans').select('id, name').eq('business_id', business.id)
    const vanIds = (vans ?? []).map((v: any) => v.id)
    const { data: orders } = vanIds.length
      ? await admin.from('orders').select('id, van_id, total, status, created_at').in('van_id', vanIds).gte('created_at', lastWeekStart)
      : { data: [] }
    const valid = (orders ?? []).filter((o: any) => !REVENUE_EXCLUDED_STATUSES.includes(o.status))
    const thisWeek = valid.filter((o: any) => o.created_at >= thisWeekStart)
    const lastWeek = valid.filter((o: any) => o.created_at < thisWeekStart)
    const thisRevenue = round2(thisWeek.reduce((s: number, o: any) => s + (o.total ?? 0), 0))
    const lastRevenue = round2(lastWeek.reduce((s: number, o: any) => s + (o.total ?? 0), 0))
    const diff = round2(thisRevenue - lastRevenue)
    const pct = lastRevenue > 0 ? round2((diff / lastRevenue) * 100) : null

    const vanTally: Record<string, number> = {}
    for (const o of thisWeek) vanTally[o.van_id] = (vanTally[o.van_id] ?? 0) + (o.total ?? 0)
    const bestVanId = Object.entries(vanTally).sort((a: any, b: any) => b[1] - a[1])[0]?.[0]
    const bestVan = (vans ?? []).find((v: any) => v.id === bestVanId)?.name

    const { data: wastage } = await admin.from('wastage_records').select('cost').eq('business_id', business.id).gte('created_at', thisWeekStart)
    const wastageCost = round2((wastage ?? []).reduce((s: number, w: any) => s + (w.cost ?? 0), 0))

    const { data: entries } = await admin.from('time_entries').select('clock_in_at, clock_out_at').eq('business_id', business.id).gte('clock_in_at', thisWeekStart)
    const staffMinutes = (entries ?? []).reduce((s: number, e: any) => e.clock_out_at ? s + (new Date(e.clock_out_at).getTime() - new Date(e.clock_in_at).getTime()) / 60000 : s, 0)

    const { count: lowStockCount } = await admin.from('stock_items').select('id', { count: 'exact', head: true }).eq('business_id', business.id).eq('active', true)
    const { count: posAwaiting } = await admin.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('business_id', business.id).in('status', ['ORDERED', 'PARTIALLY_RECEIVED'])

    const lines = [
      `💰 Revenue: £${thisRevenue.toFixed(2)} (previous week £${lastRevenue.toFixed(2)}, ${diff >= 0 ? '+' : ''}£${diff.toFixed(2)}${pct !== null ? ` / ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : ''})`,
      `📦 Orders: ${thisWeek.length}`,
      bestVan ? `🏆 Best van: ${bestVan}` : null,
      `🗑️ Wastage: £${wastageCost.toFixed(2)}`,
      `⏱️ Staff hours: ${round2(staffMinutes / 60)}`,
      `📋 Purchase orders awaiting delivery: ${posAwaiting ?? 0}`,
    ].filter(Boolean)
    const body = lines.join('\n')

    const recipients = await getRecipients(admin, business.id, 'view_analytics')
    const result = await notify(admin, {
      businessId: business.id, automationType: 'weekly_summary', recipients,
      title: `📊 Weekly summary — ${business.name}`, body, category: 'reports', priority: 'INFO', actionUrl: '/dashboard/analytics',
    })
    await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'notified', result: { thisRevenue, lastRevenue, diff, pct, ...result } })
  } catch (e: any) {
    await completeRun(admin, runId, { status: 'FAILED', failureReason: e.message ?? 'unknown_error' })
  }
}
