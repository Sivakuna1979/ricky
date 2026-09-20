// @ts-nocheck
// D15 — staff/shift operational alerts. Deliberately conservative grace
// periods to avoid false alarms (explicitly required by the brief) — this
// is not payroll, just "does something look operationally wrong today".
import { claimRun, completeRun, notify } from '../engine'
import { getResolvedSettings } from '../settings'
import { getRecipients } from '../recipients'
import { nowInTimezone, todayDateInTimezone } from '../timezone'
import { scheduleDayOfWeek } from '@/lib/schedule/dayOfWeek'

const CLOCK_IN_GRACE_MINUTES = 15
const MISSING_CLOCKOUT_HOURS = 12

export async function runStaffAutomations(admin: any, business: { id: string; timezone: string }) {
  const settings = await getResolvedSettings(admin, business.id)
  const { hour, minute, date: today } = nowInTimezone(business.timezone)
  const tomorrow = new Date(`${today}T00:00:00Z`)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const tomorrowDate = tomorrow.toISOString().slice(0, 10)

  // D15 — tomorrow's scheduled van has no shift assigned.
  if (settings.staff_unassigned_shift.enabled) {
    // Fixed during the Phase G data audit (G1) — was querying
    // van_schedule (0=Mon) with a raw JS getUTCDay() (0=Sun) value.
    const tomorrowDow = scheduleDayOfWeek(tomorrow)
    const { data: vans } = await admin.from('vans').select('id, name').eq('business_id', business.id).eq('is_active', true)
    for (const van of vans ?? []) {
      const { data: schedule } = await admin.from('van_schedule').select('id').eq('van_id', van.id).eq('day_of_week', tomorrowDow).limit(1)
      if (!schedule?.length) continue // van isn't scheduled to operate tomorrow at all
      const { data: shifts } = await admin.from('shifts').select('id').eq('van_id', van.id).eq('shift_date', tomorrowDate).limit(1)
      if (shifts?.length) continue

      const runId = await claimRun(admin, business.id, 'staff_unassigned_shift', `staff_unassigned:${van.id}:${tomorrowDate}`)
      if (!runId) continue
      const recipients = await getRecipients(admin, business.id, 'manage_shifts')
      const result = await notify(admin, {
        businessId: business.id, automationType: 'staff_unassigned_shift', recipients,
        title: `👥 ${van.name} — no staff assigned tomorrow`,
        body: `${van.name} is scheduled to operate tomorrow but has no shift assigned.`,
        category: 'staff', priority: 'ACTION', actionUrl: '/dashboard/team',
      })
      await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'notified', result })
    }
  }

  // D15 — scheduled shift has started, staff hasn't clocked in.
  if (settings.staff_late_clockin.enabled) {
    const { data: todaysShifts } = await admin.from('shifts').select('id, staff_id, start_time, staff(users(full_name, email))').eq('business_id', business.id).eq('shift_date', today)
    for (const shift of todaysShifts ?? []) {
      const [startHour, startMinute] = String(shift.start_time).split(':').map(Number)
      const nowMinutes = hour * 60 + minute
      const graceMinutes = startHour * 60 + startMinute + CLOCK_IN_GRACE_MINUTES
      if (nowMinutes < graceMinutes) continue

      const { data: entries } = await admin.from('time_entries').select('id').eq('staff_id', shift.staff_id).gte('clock_in_at', `${today}T00:00:00`).limit(1)
      if (entries?.length) continue

      const runId = await claimRun(admin, business.id, 'staff_late_clockin', `staff_late:${shift.id}:${today}`)
      if (!runId) continue
      const recipients = await getRecipients(admin, business.id, 'manage_shifts')
      const name = shift.staff?.users?.full_name ?? shift.staff?.users?.email ?? 'A staff member'
      const result = await notify(admin, {
        businessId: business.id, automationType: 'staff_late_clockin', recipients,
        title: `👥 ${name} hasn't clocked in`,
        body: `${name}'s shift started at ${shift.start_time} and they haven't clocked in yet.`,
        category: 'staff', priority: 'ACTION', actionUrl: '/dashboard/team',
      })
      await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'notified', result })
    }
  }

  // D15 — clocked in for an unusually long time without clocking out.
  if (settings.staff_missing_clockout.enabled) {
    const cutoff = new Date(Date.now() - MISSING_CLOCKOUT_HOURS * 3600000).toISOString()
    const { data: openEntries } = await admin.from('time_entries').select('id, staff_id, clock_in_at, staff(users(full_name, email))').eq('business_id', business.id).is('clock_out_at', null).lte('clock_in_at', cutoff)
    for (const entry of openEntries ?? []) {
      const runId = await claimRun(admin, business.id, 'staff_missing_clockout', `staff_no_clockout:${entry.id}:${today}`)
      if (!runId) continue
      const recipients = await getRecipients(admin, business.id, 'manage_shifts')
      const name = entry.staff?.users?.full_name ?? entry.staff?.users?.email ?? 'A staff member'
      const result = await notify(admin, {
        businessId: business.id, automationType: 'staff_missing_clockout', recipients,
        title: `👥 ${name} may have forgotten to clock out`,
        body: `${name} has been clocked in since ${new Date(entry.clock_in_at).toLocaleString('en-GB')} with no clock-out recorded.`,
        category: 'staff', priority: 'ACTION', actionUrl: '/dashboard/team',
      })
      await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'notified', result })
    }
  }
}
