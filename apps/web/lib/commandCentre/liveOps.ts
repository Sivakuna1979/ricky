// @ts-nocheck
// K5/K6/K7 — per-van live operations, scaling from 1 to 10+ vans with no
// per-van special-casing (every van is processed through the same code
// path). Reuses Phase J's getVanLiveStatus() for trading/stop status
// rather than re-deriving it, and the same 90-second GPS staleness
// threshold components/map/LiveVanTracker.tsx already uses client-side.
// K7 — a factual component breakdown, never a single opaque score.
import { getVanLiveStatus } from '@/lib/customer/liveStatus'
import { round2 } from '@/lib/finance/money'

const GPS_STALE_MS = 90 * 1000

export async function getVanSummary(admin: any, van: { id: string; name: string; tracking_status?: string; accepts_online_orders?: boolean }) {
  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0)
  const todayStartIso = todayStart.toISOString()

  const [liveStatus, gps, orders, staffToday, hygieneToday, vehicleAlerts] = await Promise.all([
    getVanLiveStatus(admin, van),
    admin.from('live_locations').select('recorded_at').eq('van_id', van.id).order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('orders').select('id, status, total').eq('van_id', van.id).gte('created_at', todayStartIso),
    admin.from('shifts').select('staff_id').eq('van_id', van.id).eq('shift_date', todayStartIso.slice(0, 10)),
    admin.from('hygiene_logs').select('id').eq('van_id', van.id).eq('log_type', 'opening_checklist').gte('recorded_at', todayStartIso).limit(1),
    admin.from('vehicle_details').select('mot_expiry, insurance_expiry, tax_expiry, service_due_date').eq('van_id', van.id).maybeSingle(),
  ])

  const gpsRecordedAt = gps?.data?.recorded_at ?? null
  const gpsAgeMs = gpsRecordedAt ? Date.now() - new Date(gpsRecordedAt).getTime() : null
  const gpsFresh = gpsAgeMs != null && gpsAgeMs <= GPS_STALE_MS

  const orderRows = orders?.data ?? []
  const todayRevenue = round2(orderRows.filter((o: any) => o.status !== 'cancelled').reduce((s: number, o: any) => s + (o.total ?? 0), 0))
  const openOrders = orderRows.filter((o: any) => o.status === 'preparing').length
  const readyOrders = orderRows.filter((o: any) => o.status === 'ready').length
  const pendingOrders = orderRows.filter((o: any) => o.status === 'pending' || o.status === 'accepted').length

  const vehicleFieldsSoon = vehicleAlerts?.data
    ? ['mot_expiry', 'insurance_expiry', 'tax_expiry', 'service_due_date'].filter((f) => {
        const d = vehicleAlerts.data[f]
        return d && d <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
      })
    : []

  return {
    van_id: van.id, van_name: van.name,
    trading_status: liveStatus.tradingStatus,
    ordering_open: liveStatus.orderingOpen,
    current_stop: liveStatus.currentStop,
    next_stop: liveStatus.nextStop,
    gps: gpsRecordedAt ? { recorded_at: gpsRecordedAt, age_seconds: Math.round((gpsAgeMs ?? 0) / 1000), fresh: gpsFresh } : { recorded_at: null, fresh: false },
    orders_today: { count: orderRows.length, revenue: todayRevenue, pending: pendingOrders, preparing: openOrders, ready: readyOrders },
    staff_working_today: new Set((staffToday?.data ?? []).map((s: any) => s.staff_id)).size,
    hygiene_opening_checklist_done: (hygieneToday?.data ?? []).length > 0,
    vehicle_fields_due_soon: vehicleFieldsSoon,
  }
}

// K6 — every van goes through getVanSummary identically; scaling to 10+
// vans is just calling this in parallel, no per-van branching anywhere.
export async function getAllVanSummaries(admin: any, vans: any[]) {
  return Promise.all(vans.map((v) => getVanSummary(admin, v)))
}
