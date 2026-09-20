// @ts-nocheck
// Route Intelligence analytics (G12–G20, G38) — one dispatcher route over
// ?type=, backed by the shared lib/routes/analytics.ts functions also
// used by the FoodTaxi AI route tools, so the dashboard and the AI can
// never disagree. Every query is scoped to ctx.businessId; van-restricted
// staff (G62) can only request their own assigned vans.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { assertVanAllowed } from '@/lib/ai/context'
import * as routeAnalytics from '@/lib/routes/analytics'

function defaultRange() {
  const end = new Date().toISOString().slice(0, 10)
  const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  return { start, end }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_analytics')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'route'
  const { start, end } = defaultRange()
  const startDate = searchParams.get('start') ?? start
  const endDate = searchParams.get('end') ?? end
  const vanId = searchParams.get('van_id') ?? undefined

  try {
    if (vanId) assertVanAllowed(ctx, vanId)
  } catch {
    return NextResponse.json({ error: 'Not authorized for that van' }, { status: 403 })
  }

  const admin = await createAdminClient()

  switch (type) {
    case 'route': {
      const data = await routeAnalytics.getRoutePerformance(admin, ctx.businessId, { startDate, endDate, vanId })
      return NextResponse.json(data)
    }
    case 'stop': {
      const stopId = searchParams.get('stop_id')
      if (!stopId) return NextResponse.json({ error: 'stop_id required' }, { status: 400 })
      return NextResponse.json(await routeAnalytics.getStopPerformance(admin, ctx.businessId, stopId, { startDate, endDate }))
    }
    case 'compare': {
      const ids = (searchParams.get('stop_ids') ?? '').split(',').filter(Boolean)
      if (!ids.length) return NextResponse.json({ error: 'stop_ids required' }, { status: 400 })
      return NextResponse.json(await routeAnalytics.compareStops(admin, ctx.businessId, ids, { startDate, endDate }))
    }
    case 'day-of-week': {
      if (!vanId) return NextResponse.json({ error: 'van_id required' }, { status: 400 })
      const weeksBack = Number(searchParams.get('weeks') ?? 12)
      return NextResponse.json(await routeAnalytics.getDayOfWeekPerformance(admin, ctx.businessId, vanId, weeksBack))
    }
    case 'time-of-day': {
      return NextResponse.json(await routeAnalytics.getTimeOfDayPerformance(admin, ctx.businessId, { startDate, endDate, vanId }))
    }
    case 'products': {
      const stopId = searchParams.get('stop_id')
      if (!stopId) return NextResponse.json({ error: 'stop_id required' }, { status: 400 })
      return NextResponse.json(await routeAnalytics.getProductByStop(admin, ctx.businessId, stopId, { startDate, endDate }))
    }
    case 'anomalies': {
      const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
      if (!vanId) return NextResponse.json({ error: 'van_id required' }, { status: 400 })
      return NextResponse.json(await routeAnalytics.getAnomalies(admin, ctx.businessId, vanId, date))
    }
    default:
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  }
}
