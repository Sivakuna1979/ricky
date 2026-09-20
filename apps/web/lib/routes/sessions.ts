// @ts-nocheck
// Route sessions (G8, G9, G10) — "the Friday route template" (van_schedule)
// vs "what actually happened on this specific Friday" (route_sessions +
// route_session_stops). Starting a session is optional — a business that
// never uses it just keeps working exactly as before (G9: "do not make
// this mandatory if it would disrupt existing van operations").
import { scheduleDayOfWeek } from '@/lib/schedule/dayOfWeek'
import { runEndOfRouteReview } from '@/lib/automations/evaluators/routes'

// Returns today's (or a given date's) session for a van if one exists —
// never creates one. Used by POS to show/hide the current-stop banner.
export async function getSessionForDate(admin: any, vanId: string, serviceDate: string) {
  const { data: session } = await admin.from('route_sessions').select('*').eq('van_id', vanId).eq('service_date', serviceDate).maybeSingle()
  if (!session) return null
  const { data: stops } = await admin.from('route_session_stops').select('*').eq('route_session_id', session.id).order('sequence')
  return { ...session, stops: stops ?? [] }
}

// Starts (or reopens) today's session for a van, snapshotting today's
// van_schedule as route_session_stops — denormalised at this moment so a
// later schedule edit never rewrites a historical session (see migration
// comment). Idempotent: calling this twice the same day returns the
// existing session rather than creating a duplicate (UNIQUE(van_id,
// service_date) backs this at the database level too).
export async function startRouteSession(admin: any, businessId: string, vanId: string, serviceDate: string, startedBy: string) {
  const { data: existing } = await admin.from('route_sessions').select('*').eq('van_id', vanId).eq('service_date', serviceDate).maybeSingle()
  if (existing) {
    if (existing.status === 'cancelled') {
      await admin.from('route_sessions').update({ status: 'active', started_at: new Date().toISOString(), started_by: startedBy }).eq('id', existing.id)
    }
    return getSessionForDate(admin, vanId, serviceDate)
  }

  const dow = scheduleDayOfWeek(new Date(`${serviceDate}T00:00:00Z`))
  const { data: template } = await admin.from('van_schedule').select('id, location_name, arrival_time, departure_time, sort_order').eq('van_id', vanId).eq('day_of_week', dow).order('sort_order').order('arrival_time')

  const { data: session, error } = await admin.from('route_sessions').insert({
    business_id: businessId, van_id: vanId, service_date: serviceDate, status: 'active', started_at: new Date().toISOString(), started_by: startedBy,
  }).select().single()
  if (error) throw error

  if (template?.length) {
    await admin.from('route_session_stops').insert(
      template.map((t: any, i: number) => ({
        route_session_id: session.id, van_schedule_id: t.id, sequence: i,
        location_name: t.location_name, scheduled_arrival: t.arrival_time, scheduled_departure: t.departure_time,
      }))
    )
  }
  return getSessionForDate(admin, vanId, serviceDate)
}

export async function endRouteSession(admin: any, sessionId: string, endedBy: string) {
  const { data: updated } = await admin.from('route_sessions')
    .update({ status: 'completed', ended_at: new Date().toISOString(), ended_by: endedBy })
    .eq('id', sessionId).eq('status', 'active')
    .select('business_id, van_id, service_date').maybeSingle()
  // Best-effort (G55) — a review notification failing must never block the
  // session actually ending.
  if (updated) {
    try { await runEndOfRouteReview(admin, updated.business_id, updated.van_id, updated.service_date) } catch (_e) {}
  }
}

// Manual arrival/departure marking (G10) — never inferred from schedule
// time; scheduled_arrival/scheduled_departure stay untouched alongside
// these actual_* fields.
export async function markStopStatus(admin: any, stopId: string, status: 'arrived' | 'departed' | 'skipped') {
  const update: any = { status }
  if (status === 'arrived') update.actual_arrival_at = new Date().toISOString()
  if (status === 'departed') update.actual_departure_at = new Date().toISOString()
  await admin.from('route_session_stops').update(update).eq('id', stopId)
}

// The stop a fresh POS sale should default to (G5) — the earliest stop
// still 'pending' or already 'arrived' (not yet departed), by scheduled
// order. Staff can always override in the UI; this is only a sensible
// default, never authoritative.
export function currentStopFor(session: { stops: any[] } | null) {
  if (!session) return null
  return session.stops.find((s: any) => s.status === 'arrived') ?? session.stops.find((s: any) => s.status === 'pending') ?? null
}
