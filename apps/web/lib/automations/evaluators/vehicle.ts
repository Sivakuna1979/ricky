// @ts-nocheck
// D13, D14 — vehicle and equipment renewal reminders. Exact-day threshold
// matching (not "<=") is what prevents duplicate reminders across multiple
// days for the same renewal (D13) — a date is only ever exactly 14 days
// away once.
import { claimRun, completeRun, notify } from '../engine'
import { getResolvedSettings } from '../settings'
import { getRecipients } from '../recipients'
import { todayDateInTimezone } from '../timezone'

const THRESHOLDS = [30, 14, 7, 1]
const VEHICLE_FIELDS: Record<string, string> = { mot_expiry: 'MOT', insurance_expiry: 'Insurance', tax_expiry: 'Road tax', service_due_date: 'Service' }

function daysUntil(date: string, today: string): number {
  return Math.round((new Date(date).getTime() - new Date(today).getTime()) / 86400000)
}

export async function runVehicleAutomations(admin: any, business: { id: string; timezone: string }) {
  const settings = await getResolvedSettings(admin, business.id)
  const date = todayDateInTimezone(business.timezone)

  if (settings.vehicle_reminder.enabled) {
    const { data: vehicles } = await admin.from('vehicle_details').select('van_id, mot_expiry, insurance_expiry, tax_expiry, service_due_date, vans(name)').eq('business_id', business.id)
    for (const v of vehicles ?? []) {
      for (const [field, label] of Object.entries(VEHICLE_FIELDS)) {
        const value = v[field]
        if (!value) continue
        const days = daysUntil(value, date)
        const isOverdue = days < 0
        const hitsThreshold = THRESHOLDS.includes(days)
        if (!isOverdue && !hitsThreshold) continue

        const bucket = isOverdue ? 'overdue' : String(days)
        const runId = await claimRun(admin, business.id, 'vehicle_reminder', `vehicle_reminder:${v.van_id}:${field}:${bucket}:${date}`)
        if (!runId) continue
        const recipients = await getRecipients(admin, business.id, 'manage_vehicles')
        const body = isOverdue
          ? `${v.vans?.name}'s ${label.toLowerCase()} expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago.`
          : `${v.vans?.name}'s ${label.toLowerCase()} expires in ${days} day${days === 1 ? '' : 's'}.`
        const result = await notify(admin, {
          businessId: business.id, automationType: 'vehicle_reminder', recipients,
          title: `🚐 ${v.vans?.name} — ${label} ${isOverdue ? 'overdue' : `due in ${days}d`}`,
          body, category: 'vehicle', priority: isOverdue || days <= 7 ? 'IMPORTANT' : 'ACTION', actionUrl: '/dashboard/fleet',
        })
        await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'notified', result })
      }
    }
  }

  if (settings.equipment_reminder.enabled) {
    const { data: equipment } = await admin.from('equipment').select('id, name, next_service_date, warranty_expiry').eq('business_id', business.id).neq('status', 'retired')
    for (const eq of equipment ?? []) {
      for (const [field, label] of [['next_service_date', 'service'], ['warranty_expiry', 'warranty']] as const) {
        const value = eq[field]
        if (!value) continue
        const days = daysUntil(value, date)
        const isOverdue = days < 0
        const hitsThreshold = THRESHOLDS.includes(days)
        if (!isOverdue && !hitsThreshold) continue

        const bucket = isOverdue ? 'overdue' : String(days)
        const runId = await claimRun(admin, business.id, 'equipment_reminder', `equipment_reminder:${eq.id}:${field}:${bucket}:${date}`)
        if (!runId) continue
        const recipients = await getRecipients(admin, business.id, 'manage_vehicles')
        const body = isOverdue
          ? `${eq.name}'s ${label} was due ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago.`
          : `${eq.name}'s ${label} due in ${days} day${days === 1 ? '' : 's'}.`
        const result = await notify(admin, {
          businessId: business.id, automationType: 'equipment_reminder', recipients,
          title: `🔧 ${eq.name} — ${label} ${isOverdue ? 'overdue' : `due in ${days}d`}`,
          body, category: 'vehicle', priority: isOverdue ? 'IMPORTANT' : 'ACTION', actionUrl: '/dashboard/fleet',
        })
        await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'notified', result })
      }
    }
  }
}
