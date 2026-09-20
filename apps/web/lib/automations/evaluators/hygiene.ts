// @ts-nocheck
// D11, D12 — missed hygiene checklist alerts. Reads the existing
// hygiene_logs table (opening_checklist/closing_checklist log types,
// already written by /dashboard/hygiene) — never creates or fabricates a
// check, only alerts that one is missing.
import { claimRun, completeRun, notify } from '../engine'
import { getResolvedSettings } from '../settings'
import { getRecipients } from '../recipients'
import { nowInTimezone, todayDateInTimezone } from '../timezone'

// Business-local deadlines before a missing check is worth flagging —
// avoids alerting at 9am that the closing checklist (due at close) is
// "missing". Configurable later via automation_settings.config if needed;
// these are sensible, documented defaults for now.
const DEADLINES = { opening_checklist: 11, closing_checklist: 21 }

export async function runHygieneAutomations(admin: any, business: { id: string; timezone: string }) {
  const settings = await getResolvedSettings(admin, business.id)
  if (!settings.hygiene_missed.enabled) return

  const { hour } = nowInTimezone(business.timezone)
  const date = todayDateInTimezone(business.timezone)
  const todayStart = `${date}T00:00:00`

  const { data: vans } = await admin.from('vans').select('id, name').eq('business_id', business.id).eq('is_active', true)
  if (!vans?.length) return

  for (const [checklistType, deadlineHour] of Object.entries(DEADLINES)) {
    if (hour < deadlineHour) continue
    const { data: done } = await admin.from('hygiene_logs').select('van_id').eq('log_type', checklistType).gte('recorded_at', todayStart).in('van_id', vans.map((v: any) => v.id))
    const doneVanIds = new Set((done ?? []).map((d: any) => d.van_id))

    for (const van of vans) {
      if (doneVanIds.has(van.id)) continue
      const runId = await claimRun(admin, business.id, 'hygiene_missed', `hygiene_missed:${van.id}:${checklistType}:${date}`)
      if (!runId) continue
      const recipients = await getRecipients(admin, business.id, 'manage_hygiene')
      const label = checklistType === 'opening_checklist' ? 'opening checklist' : 'closing checklist'
      const result = await notify(admin, {
        businessId: business.id, automationType: 'hygiene_missed', recipients,
        title: `🧼 ${van.name} — ${label} not completed`,
        body: `${van.name}'s ${label} has not been completed today.`,
        category: 'hygiene', priority: 'IMPORTANT', actionUrl: '/dashboard/hygiene',
      })
      await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'notified', result })
    }
  }
}
