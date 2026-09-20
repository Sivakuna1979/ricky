// @ts-nocheck
// ============================================================================
// PHASE B12–B17 — FoodTaxi Business analytics. Server-side aggregation only
// (no full order history sent to the browser, per B16) over the last 30
// days, plus separately-bounded Today/This Week/This Month summaries.
//
// Revenue definition (B17, documented — do not change without updating this
// comment and docs/FOODTAXI-TECHNICAL-BASELINE.md): SUM(orders.total) for
// every order except status = 'cancelled'. This is the exact rule the main
// dashboard already used pre-Phase-B for "Today's Sales" — extended here
// rather than redefined, so the two numbers never disagree. All channels
// (online, guest, POS, WhatsApp) and all payment methods count; only a
// cancelled order is excluded.
//
// Known limitation: day/week/month boundaries use server (UTC) time, not
// Europe/London local time — during British Summer Time this can shift an
// order near midnight into the adjacent bucket by up to an hour. Documented
// rather than silently assumed correct; a future fix would compute
// boundaries in Europe/London explicitly.
//
// Ownership: van_id is only ever taken from a business's own vans (RLS +an
// explicit server-side check), never trusted as-is from the query string.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const REVENUE_EXCLUDED_STATUSES = ['cancelled']
const WINDOW_DAYS = 30

function round2(n: number) { return Math.round((n ?? 0) * 100) / 100 }
function zeroSummary() { return { revenue: 0, orders: 0, averageOrderValue: 0 } }
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function startOfWeek(d: Date) { const x = startOfDay(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  if (!userData) return NextResponse.json({ error: 'User profile not found' }, { status: 404 })

  const { data: business } = await supabase.from('businesses').select('id').eq('owner_id', userData.id).maybeSingle()
  if (!business) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const { data: allVans } = await supabase.from('vans').select('id, name').eq('business_id', business.id).order('name')
  const ownedVanIds = (allVans ?? []).map((v: any) => v.id)

  if (ownedVanIds.length === 0) {
    return NextResponse.json({
      vans: [], today: zeroSummary(), week: zeroSummary(), month: zeroSummary(),
      revenueTrend: [], salesByDay: [], salesByHour: [], paymentMethods: [], sources: [], vanBreakdown: [], bestSellers: [],
      windowDays: WINDOW_DAYS,
    })
  }

  const { searchParams } = new URL(req.url)
  const vanParam = searchParams.get('van_id')
  let vanIds = ownedVanIds
  if (vanParam && vanParam !== 'all') {
    if (!ownedVanIds.includes(vanParam)) return NextResponse.json({ error: 'Van not found for this business' }, { status: 403 })
    vanIds = [vanParam]
  }

  const now = new Date()
  const todayStart = startOfDay(now)
  const weekStart = startOfWeek(now)
  const monthStart = startOfMonth(now)
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 86400000)

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, van_id, total, status, payment_method, source, created_at')
    .in('van_id', vanIds)
    .gte('created_at', windowStart.toISOString())
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const revenueOrders = (orders ?? []).filter((o: any) => !REVENUE_EXCLUDED_STATUSES.includes(o.status))

  function summarize(from: Date) {
    const rows = revenueOrders.filter((o: any) => new Date(o.created_at) >= from)
    const revenue = rows.reduce((s: number, o: any) => s + (o.total ?? 0), 0)
    const count = rows.length
    return { revenue: round2(revenue), orders: count, averageOrderValue: count ? round2(revenue / count) : 0 }
  }

  const trendMap: Record<string, { revenue: number; orders: number }> = {}
  for (const o of revenueOrders) {
    const day = o.created_at.slice(0, 10)
    if (!trendMap[day]) trendMap[day] = { revenue: 0, orders: 0 }
    trendMap[day].revenue += o.total ?? 0
    trendMap[day].orders += 1
  }
  const revenueTrend = Object.entries(trendMap).sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, revenue: round2(v.revenue), orders: v.orders }))

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const byDay: Record<string, number> = {}
  const byHour: Record<number, number> = {}
  for (const o of revenueOrders) {
    const d = new Date(o.created_at)
    byDay[DOW[d.getDay()]] = (byDay[DOW[d.getDay()]] ?? 0) + (o.total ?? 0)
    byHour[d.getHours()] = (byHour[d.getHours()] ?? 0) + (o.total ?? 0)
  }
  const salesByDay = DOW.map(d => ({ day: d, revenue: round2(byDay[d] ?? 0) }))
  const salesByHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: round2(byHour[h] ?? 0) }))

  const paymentTally: Record<string, { revenue: number; count: number }> = {}
  const sourceTally: Record<string, { revenue: number; count: number }> = {}
  for (const o of revenueOrders) {
    const pm = o.payment_method ?? 'unknown'
    paymentTally[pm] = paymentTally[pm] ?? { revenue: 0, count: 0 }
    paymentTally[pm].revenue += o.total ?? 0; paymentTally[pm].count += 1
    const src = o.source ?? 'unknown'
    sourceTally[src] = sourceTally[src] ?? { revenue: 0, count: 0 }
    sourceTally[src].revenue += o.total ?? 0; sourceTally[src].count += 1
  }
  const paymentMethods = Object.entries(paymentTally).map(([method, v]) => ({ method, revenue: round2(v.revenue), count: v.count }))
  const sources = Object.entries(sourceTally).map(([source, v]) => ({ source, revenue: round2(v.revenue), count: v.count }))

  const vanTally: Record<string, { revenue: number; orders: number }> = {}
  for (const o of revenueOrders) {
    vanTally[o.van_id] = vanTally[o.van_id] ?? { revenue: 0, orders: 0 }
    vanTally[o.van_id].revenue += o.total ?? 0; vanTally[o.van_id].orders += 1
  }
  const vanBreakdown = (allVans ?? [])
    .filter((v: any) => vanIds.includes(v.id))
    .map((v: any) => ({ van_id: v.id, van_name: v.name, revenue: round2(vanTally[v.id]?.revenue ?? 0), orders: vanTally[v.id]?.orders ?? 0 }))
    .sort((a: any, b: any) => b.revenue - a.revenue)

  const orderIdsInWindow = revenueOrders.map((o: any) => o.id)
  let bestSellers: any[] = []
  if (orderIdsInWindow.length) {
    const { data: items } = await supabase
      .from('order_items').select('name, quantity, item_total, order_id').in('order_id', orderIdsInWindow.slice(0, 500))
    const tally: Record<string, { qty: number; revenue: number }> = {}
    for (const it of items ?? []) {
      tally[it.name] = tally[it.name] ?? { qty: 0, revenue: 0 }
      tally[it.name].qty += it.quantity ?? 1
      tally[it.name].revenue += it.item_total ?? 0
    }
    bestSellers = Object.entries(tally)
      .map(([name, v]) => ({ name, quantity: v.qty, revenue: round2(v.revenue) }))
      .sort((a, b) => b.quantity - a.quantity).slice(0, 10)
  }

  return NextResponse.json({
    vans: allVans ?? [],
    today: summarize(todayStart),
    week: summarize(weekStart),
    month: summarize(monthStart),
    revenueTrend,
    salesByDay,
    salesByHour,
    paymentMethods,
    sources,
    vanBreakdown,
    bestSellers,
    windowDays: WINDOW_DAYS,
  })
}
