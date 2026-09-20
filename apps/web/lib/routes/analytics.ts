// @ts-nocheck
// Route/stop analytics (G12–G20, G29, G31, G37, G38). Shared by both the
// dashboard API routes and the FoodTaxi AI route tools, so the two
// surfaces can never disagree — one calculation, two consumers.
//
// Revenue rule: identical to Phase B's analytics (sum of orders.total,
// excluding only status='cancelled'). Dated by orders.service_date (the
// Phase G column — the actual collection/trading date), not created_at —
// this only applies to NEW Phase G analytics; Phase B/D's own analytics
// are untouched and still use created_at, documented as a known
// difference rather than silently reconciled (retrofitting those is a
// separate, riskier change to already-shipped, working features).
//
// "Stop-level reporting is available from the date pickup_stop_id started
// being populated" (G33/G57) — orders with service_date before that
// deployment simply have pickup_stop_id = NULL and are excluded from
// stop-level (but not van-level) breakdowns; this file never guesses one.
const REVENUE_EXCLUDED_STATUSES = ['cancelled']
export function round2(n: number) { return Math.round((n ?? 0) * 100) / 100 }

async function fetchOrders(admin: any, vanIds: string[], startDate: string, endDate: string) {
  if (!vanIds.length) return []
  const { data, error } = await admin
    .from('orders')
    .select('id, van_id, total, status, pickup_stop_id, service_date, created_at, payment_method, source')
    .in('van_id', vanIds).gte('service_date', startDate).lte('service_date', endDate)
  if (error) throw new Error('orders_query_failed')
  return (data ?? []).filter((o: any) => !REVENUE_EXCLUDED_STATUSES.includes(o.status))
}

function summarize(orders: any[]) {
  const revenue = round2(orders.reduce((s, o) => s + (o.total ?? 0), 0))
  const count = orders.length
  return { revenue, orders: count, average_order_value: count ? round2(revenue / count) : 0 }
}

// G13 — route/van-level KPIs for a date range.
export async function getRoutePerformance(admin: any, businessId: string, opts: { startDate: string; endDate: string; vanId?: string }) {
  const { data: vans } = await admin.from('vans').select('id, name').eq('business_id', businessId)
  const vanIds = opts.vanId ? [opts.vanId] : (vans ?? []).map((v: any) => v.id)
  const orders = await fetchOrders(admin, vanIds, opts.startDate, opts.endDate)

  const byVan: Record<string, any[]> = {}
  for (const o of orders) (byVan[o.van_id] ??= []).push(o)
  const vans_breakdown = (vans ?? []).filter((v: any) => vanIds.includes(v.id)).map((v: any) => ({ van: v.name, van_id: v.id, ...summarize(byVan[v.id] ?? []) })).sort((a, b) => b.revenue - a.revenue)

  return { ...summarize(orders), vans: vans_breakdown, date_range: { start: opts.startDate, end: opts.endDate } }
}

// G14 — a single stop's performance, including revenue/hour ONLY when a
// real recorded trading duration exists (never scheduled time as a
// stand-in — G10/G14's explicit rule).
export async function getStopPerformance(admin: any, businessId: string, vanScheduleId: string, opts: { startDate: string; endDate: string }) {
  const { data: stopTemplate } = await admin.from('van_schedule').select('id, van_id, location_name, vans(business_id)').eq('id', vanScheduleId).maybeSingle()
  if (!stopTemplate || stopTemplate.vans?.business_id !== businessId) return { found: false }

  const { data: orders, error } = await admin
    .from('orders').select('id, total, status, service_date')
    .eq('pickup_stop_id', vanScheduleId).gte('service_date', opts.startDate).lte('service_date', opts.endDate)
  if (error) throw new Error('orders_query_failed')
  const validOrders = (orders ?? []).filter((o: any) => !REVENUE_EXCLUDED_STATUSES.includes(o.status))

  const { data: sessionStops } = await admin
    .from('route_session_stops').select('actual_arrival_at, actual_departure_at, route_sessions!inner(service_date, van_id)')
    .eq('van_schedule_id', vanScheduleId).gte('route_sessions.service_date', opts.startDate).lte('route_sessions.service_date', opts.endDate)
  const durations = (sessionStops ?? []).filter((s: any) => s.actual_arrival_at && s.actual_departure_at)
    .map((s: any) => (new Date(s.actual_departure_at).getTime() - new Date(s.actual_arrival_at).getTime()) / 60000)
  const totalTradingMinutes = durations.reduce((s: number, m: number) => s + m, 0)

  const summary = summarize(validOrders)
  const revenuePerHour = totalTradingMinutes > 0 ? round2(summary.revenue / (totalTradingMinutes / 60)) : null

  const orderIds = validOrders.map((o: any) => o.id)
  let topProducts: any[] = []
  if (orderIds.length) {
    const { data: items } = await admin.from('order_items').select('name, quantity').in('order_id', orderIds.slice(0, 500))
    const tally: Record<string, number> = {}
    for (const it of items ?? []) tally[it.name] = (tally[it.name] ?? 0) + (it.quantity ?? 1)
    topProducts = Object.entries(tally).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5).map(([name, quantity]) => ({ name, quantity }))
  }

  return {
    found: true, stop: stopTemplate.location_name,
    ...summary,
    trading_minutes_recorded: durations.length ? round2(totalTradingMinutes) : null,
    trading_sessions_with_recorded_duration: durations.length,
    revenue_per_hour: revenuePerHour,
    revenue_per_hour_note: revenuePerHour === null ? 'No recorded arrival/departure times for this stop in this period — revenue/hour cannot be calculated without a real trading duration.' : null,
    top_products: topProducts,
  }
}

// G15 — compare several stops side by side. No good/bad labels (G15) —
// just the same metrics per stop, side by side.
export async function compareStops(admin: any, businessId: string, vanScheduleIds: string[], opts: { startDate: string; endDate: string }) {
  const results = []
  for (const id of vanScheduleIds) results.push(await getStopPerformance(admin, businessId, id, opts))
  return { stops: results.filter(r => r.found) }
}

// G16 — day-of-week performance with explicit sample size (never hide a
// small n), and trading-day distinction (G37): only dates where the van
// actually had at least one valid order, or a non-cancelled route
// session, count as a "trading day" sample. A day with zero orders and no
// session for that date is excluded entirely, not counted as a £0 day.
export async function getDayOfWeekPerformance(admin: any, businessId: string, vanId: string, weeksBack = 12) {
  const startDate = new Date(Date.now() - weeksBack * 7 * 86400000).toISOString().slice(0, 10)
  const endDate = new Date().toISOString().slice(0, 10)
  const orders = await fetchOrders(admin, [vanId], startDate, endDate)

  const { data: sessions } = await admin.from('route_sessions').select('service_date').eq('van_id', vanId).neq('status', 'cancelled').gte('service_date', startDate).lte('service_date', endDate)
  const tradingDates = new Set<string>([...orders.map((o: any) => o.service_date), ...(sessions ?? []).map((s: any) => s.service_date)])

  const DOW_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const byDow: Record<number, { dates: Set<string>; revenue: number; orders: number }> = {}
  for (const date of tradingDates) {
    const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
    byDow[dow] ??= { dates: new Set(), revenue: 0, orders: 0 }
    byDow[dow].dates.add(date)
  }
  for (const o of orders) {
    const dow = (new Date(`${o.service_date}T00:00:00Z`).getUTCDay() + 6) % 7
    byDow[dow] ??= { dates: new Set(), revenue: 0, orders: 0 }
    byDow[dow].revenue += o.total ?? 0
    byDow[dow].orders += 1
  }

  return {
    period_weeks: weeksBack,
    days: DOW_LABELS.map((label, dow) => {
      const d = byDow[dow]
      const sampleSize = d?.dates.size ?? 0
      return {
        day: label, trading_days_sampled: sampleSize,
        average_revenue: sampleSize ? round2(d.revenue / sampleSize) : null,
        average_orders: sampleSize ? round2(d.orders / sampleSize) : null,
        average_order_value: d?.orders ? round2(d.revenue / d.orders) : null,
      }
    }),
  }
}

// G17 — time-of-day bands.
export async function getTimeOfDayPerformance(admin: any, businessId: string, opts: { startDate: string; endDate: string; vanId?: string }) {
  const { data: vans } = await admin.from('vans').select('id').eq('business_id', businessId)
  const vanIds = opts.vanId ? [opts.vanId] : (vans ?? []).map((v: any) => v.id)
  const orders = await fetchOrders(admin, vanIds, opts.startDate, opts.endDate)

  const byHour: Record<number, { revenue: number; orders: number }> = {}
  for (const o of orders) {
    const hour = new Date(o.created_at).getUTCHours()
    byHour[hour] ??= { revenue: 0, orders: 0 }
    byHour[hour].revenue += o.total ?? 0
    byHour[hour].orders += 1
  }
  const bands = Array.from({ length: 24 }, (_, h) => ({
    band: `${String(h).padStart(2, '0')}:00–${String((h + 1) % 24).padStart(2, '0')}:00`,
    revenue: round2(byHour[h]?.revenue ?? 0), orders: byHour[h]?.orders ?? 0,
    average_order_value: byHour[h]?.orders ? round2(byHour[h].revenue / byHour[h].orders) : 0,
  })).filter(b => b.orders > 0)
  return { bands }
}

// G18 — product mix at a stop, as % of that stop's items sold.
export async function getProductByStop(admin: any, businessId: string, vanScheduleId: string, opts: { startDate: string; endDate: string }) {
  const { data: stopTemplate } = await admin.from('van_schedule').select('id, location_name, vans(business_id)').eq('id', vanScheduleId).maybeSingle()
  if (!stopTemplate || stopTemplate.vans?.business_id !== businessId) return { found: false }

  const { data: orders } = await admin.from('orders').select('id, status').eq('pickup_stop_id', vanScheduleId).gte('service_date', opts.startDate).lte('service_date', opts.endDate)
  const orderIds = (orders ?? []).filter((o: any) => !REVENUE_EXCLUDED_STATUSES.includes(o.status)).map((o: any) => o.id)
  if (!orderIds.length) return { found: true, stop: stopTemplate.location_name, products: [] }

  const { data: items } = await admin.from('order_items').select('name, quantity').in('order_id', orderIds.slice(0, 500))
  const tally: Record<string, number> = {}
  let totalQty = 0
  for (const it of items ?? []) { tally[it.name] = (tally[it.name] ?? 0) + (it.quantity ?? 1); totalQty += it.quantity ?? 1 }
  const products = Object.entries(tally).sort((a: any, b: any) => b[1] - a[1]).map(([name, qty]) => ({ name, quantity: qty, percent: totalQty ? round2((qty as number) / totalQty * 100) : 0 }))
  return { found: true, stop: stopTemplate.location_name, products }
}

// G38 — simple, factual anomaly detection: this period vs the average of
// the preceding N comparable periods (same van). Never invents a cause.
export async function getAnomalies(admin: any, businessId: string, vanId: string, date: string) {
  const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
  const lookbackStart = new Date(new Date(`${date}T00:00:00Z`).getTime() - 12 * 7 * 86400000).toISOString().slice(0, 10)
  const orders = await fetchOrders(admin, [vanId], lookbackStart, date)

  const byDate: Record<string, { revenue: number; orders: number }> = {}
  for (const o of orders) {
    byDate[o.service_date] ??= { revenue: 0, orders: 0 }
    byDate[o.service_date].revenue += o.total ?? 0
    byDate[o.service_date].orders += 1
  }
  const sameDowDates = Object.keys(byDate).filter(d => d !== date && (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7 === dow)
  if (!byDate[date]) return { date, has_data: false, message: 'No orders recorded for this date.' }
  if (sameDowDates.length < 3) return { date, has_data: true, comparable_days: sameDowDates.length, message: `Only ${sameDowDates.length} comparable day(s) of history — not enough to judge whether this was unusual.` }

  const avgRevenue = sameDowDates.reduce((s, d) => s + byDate[d].revenue, 0) / sameDowDates.length
  const avgOrders = sameDowDates.reduce((s, d) => s + byDate[d].orders, 0) / sameDowDates.length
  const revenuePctDiff = avgRevenue ? round2(((byDate[date].revenue - avgRevenue) / avgRevenue) * 100) : null
  const ordersPctDiff = avgOrders ? round2(((byDate[date].orders - avgOrders) / avgOrders) * 100) : null

  return {
    date, has_data: true, comparable_days: sameDowDates.length,
    revenue: round2(byDate[date].revenue), average_revenue_same_weekday: round2(avgRevenue), revenue_percent_difference: revenuePctDiff,
    orders: byDate[date].orders, average_orders_same_weekday: round2(avgOrders), orders_percent_difference: ordersPctDiff,
    is_notable: revenuePctDiff !== null && Math.abs(revenuePctDiff) >= 20,
  }
}
