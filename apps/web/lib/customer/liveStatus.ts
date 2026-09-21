// @ts-nocheck
// J29/J30/J32 — derives a customer-safe live status from real schedule/
// session/tracking data only. Never fabricates an ETA, never claims
// "LIVE NOW" just because a schedule exists for today, and always keeps
// SCHEDULED (van_schedule template) separate from ACTUAL (route_session_stops
// arrival/departure) — mirroring the business-side CurrentStopBanner logic
// (components/routes/CurrentStopBanner.tsx) rather than inventing a second
// notion of "current stop".
import { getSessionForDate } from '@/lib/routes/sessions'

function currentAndNextStop(session: any) {
  const stops = session?.stops ?? []
  return {
    current: stops.find((s: any) => s.status === 'arrived') ?? null,
    next: stops.find((s: any) => s.status === 'pending') ?? null,
  }
}

export async function getVanLiveStatus(admin: any, van: { id: string; tracking_status?: string; accepts_online_orders?: boolean }) {
  const todayIso = new Date().toISOString().slice(0, 10)
  const dow = (new Date().getDay() + 6) % 7

  let tradingStatus: 'LIVE_NOW' | 'SCHEDULED_TODAY' | 'NOT_TRADING' = van.tracking_status === 'live' ? 'LIVE_NOW' : 'NOT_TRADING'
  let currentStop: any = null
  let nextStop: any = null
  let stopSource: 'actual' | 'scheduled' | 'none' = 'none'

  try {
    const session = await getSessionForDate(admin, van.id, todayIso)
    if (session && session.status === 'active') {
      const { current, next } = currentAndNextStop(session)
      if (current) {
        currentStop = { location_name: current.location_name, scheduled_arrival: current.scheduled_arrival, actual_arrival_at: current.actual_arrival_at }
        tradingStatus = 'LIVE_NOW'
        stopSource = 'actual'
      }
      if (next) {
        nextStop = { location_name: next.location_name, scheduled_arrival: next.scheduled_arrival }
        stopSource = 'actual'
      }
    }
  } catch { /* route sessions are optional infrastructure (G9) — never break the van page */ }

  // No active session — fall back to the plain schedule template, always
  // labelled as SCHEDULED, never ACTUAL.
  if (!currentStop && !nextStop) {
    try {
      const { data: todayStops } = await admin.from('van_schedule').select('location_name, arrival_time, departure_time').eq('van_id', van.id).eq('day_of_week', dow).order('arrival_time')
      if (todayStops?.length) {
        const nowHm = new Date().toTimeString().slice(0, 5)
        const upcoming = todayStops.find((s: any) => s.departure_time >= nowHm) ?? todayStops[0]
        nextStop = { location_name: upcoming.location_name, scheduled_arrival: upcoming.arrival_time }
        stopSource = 'scheduled'
        if (tradingStatus === 'NOT_TRADING') tradingStatus = 'SCHEDULED_TODAY'
      }
    } catch { /* schedule read failing must never break the van page */ }
  }

  return {
    tradingStatus,
    orderingOpen: van.accepts_online_orders !== false,
    currentStop,
    nextStop,
    stopSource,
  }
}
