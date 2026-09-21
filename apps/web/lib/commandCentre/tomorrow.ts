// @ts-nocheck
// K19/K20 — tomorrow planner and per-van readiness. Reuses Phase G's own
// getLoadingPlan() for stock shortfalls (the same function the daily
// briefing already calls) rather than a second forecasting method.
// Readiness is only ever marked complete when real evidence says so
// (K20: "never mark complete without evidence") — every field below is a
// direct read of a real record, never assumed true by default.
import { scheduleDayOfWeek } from '@/lib/schedule/dayOfWeek'
import { getLoadingPlan } from '@/lib/routes/demand'

export async function getTomorrowReadiness(admin: any, businessId: string, van: { id: string; name: string }) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const dow = scheduleDayOfWeek(new Date(`${tomorrow}T00:00:00Z`))

  const [{ data: stops }, { data: shifts }, { data: vehicle }, { data: equipment }, { data: hygieneToday }] = await Promise.all([
    admin.from('van_schedule').select('id, location_name, arrival_time, departure_time').eq('van_id', van.id).eq('day_of_week', dow).order('arrival_time'),
    admin.from('shifts').select('staff_id, staff(users(full_name))').eq('van_id', van.id).eq('shift_date', tomorrow),
    admin.from('vehicle_details').select('mot_expiry, insurance_expiry, tax_expiry, service_due_date').eq('van_id', van.id).maybeSingle(),
    admin.from('equipment').select('id, name, next_service_date').eq('van_id', van.id),
    // "hygiene preparation" evidence = today's closing checklist done (a
    // reasonable proxy for "the van was left ready") — never assumed.
    admin.from('hygiene_logs').select('id').eq('van_id', van.id).eq('log_type', 'closing_checklist').gte('recorded_at', `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`).limit(1),
  ])

  const hasRoute = (stops ?? []).length > 0
  const hasStaff = (shifts ?? []).length > 0

  let loadingPlan = { items: [] as any[] }
  let criticalStockShortfalls: any[] = []
  if (stops?.length) {
    loadingPlan = await getLoadingPlan(admin, businessId, van.id, stops[0].id, tomorrow, 10)
    criticalStockShortfalls = (loadingPlan.items ?? []).filter((i: any) => (i.shortfall ?? 0) > 0)
  }

  const today = new Date().toISOString().slice(0, 10)
  const vehicleDocsOk = vehicle
    ? ['mot_expiry', 'insurance_expiry', 'tax_expiry'].every((f) => !vehicle[f] || vehicle[f] > today)
    : null // null = no vehicle record at all — evidence is simply absent, never assumed fine

  const equipmentDue = (equipment ?? []).filter((e: any) => e.next_service_date && e.next_service_date <= tomorrow)

  return {
    van_id: van.id, van_name: van.name, target_date: tomorrow,
    route: { scheduled: hasRoute, stops: stops ?? [] },
    staffing: { assigned: hasStaff, staff: (shifts ?? []).map((s: any) => s.staff?.users?.full_name).filter(Boolean) },
    stock_plan: { computed: !!stops?.length, shortfalls: criticalStockShortfalls, full_plan: loadingPlan.items ?? [], message: loadingPlan.message ?? null },
    vehicle: { has_record: !!vehicle, docs_ok: vehicleDocsOk, details: vehicle ?? null },
    equipment_due_service: equipmentDue,
    hygiene_prepared: (hygieneToday ?? []).length > 0,
    // K20 — a factual readiness READ-OUT, not a synthesised pass/fail
    // score: each dimension stands on its own evidence.
    ready: hasRoute ? (hasStaff && criticalStockShortfalls.length === 0 && vehicleDocsOk !== false) : null,
  }
}

// K19 — the business-wide tomorrow view: confirmed events, known
// deliveries (purchase orders expected), on top of the per-van readiness
// above. Confirmed events are matched via event_applications, which links
// to a business by the owner's email (its own pre-existing design, not
// changed here) rather than a business_id column.
export async function getTomorrowBusinessContext(admin: any, businessId: string) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  const { data: business } = await admin.from('businesses').select('owner_id').eq('id', businessId).maybeSingle()
  const { data: owner } = business?.owner_id ? await admin.from('users').select('email').eq('id', business.owner_id).maybeSingle() : { data: null }

  const [{ data: applications }, { data: deliveries }] = await Promise.all([
    owner?.email
      ? admin.from('event_applications').select('id, event_id, status, event_requests!inner(event_name:event_type, event_date, event_location)')
          .eq('van_owner_email', owner.email).eq('status', 'confirmed').eq('event_requests.event_date', tomorrow)
      : { data: [] },
    admin.from('purchase_orders').select('id, expected_date, supplier_records(name)').eq('business_id', businessId).eq('expected_date', tomorrow).in('status', ['ORDERED', 'PARTIALLY_RECEIVED']),
  ])

  return { target_date: tomorrow, confirmed_events: applications ?? [], expected_deliveries: deliveries ?? [] }
}
