// @ts-nocheck
// D22, D23 — marketing SUGGESTIONS only. Never sends anything itself; it
// creates a notification with a count and a link to the existing
// /dashboard/marketing page, where the owner reviews and sends manually
// (respecting the existing unsubscribe list, which /api/marketing/send
// already checks). Runs weekly, same cadence family as the weekly summary.
import { claimRun, completeRun, notify } from '../engine'
import { getResolvedSettings } from '../settings'
import { getRecipients } from '../recipients'
import { nowInTimezone, isDueNow, isoWeekKey } from '../timezone'

const LAPSED_AFTER_DAYS = 21
const ACTIVE_WINDOW_DAYS = 60

export async function runMarketingSuggestions(admin: any, business: { id: string; timezone: string; name: string }) {
  const settings = await getResolvedSettings(admin, business.id)
  if (!settings.marketing_suggestion.enabled) return
  const targetWeekday = settings.marketing_suggestion.config?.weekday ?? 'Mon'
  const hour = settings.marketing_suggestion.config?.hour ?? 9
  const minute = settings.marketing_suggestion.config?.minute ?? 0
  const now = nowInTimezone(business.timezone)
  if (now.weekday !== targetWeekday || !isDueNow(business.timezone, hour, minute)) return

  const weekKey = isoWeekKey(business.timezone)
  const runId = await claimRun(admin, business.id, 'marketing_suggestion', `marketing_suggestion:${business.id}:${weekKey}`)
  if (!runId) return

  try {
    const { data: vans } = await admin.from('vans').select('id, name').eq('business_id', business.id)
    const activeSince = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86400000).toISOString()
    const lapsedCutoff = new Date(Date.now() - LAPSED_AFTER_DAYS * 86400000).toISOString()

    const suggestions: { van: string; count: number }[] = []
    for (const van of vans ?? []) {
      const { data: activeOrders } = await admin.from('orders').select('guest_email').eq('van_id', van.id).gte('created_at', activeSince).not('guest_email', 'is', null)
      const { data: recentOrders } = await admin.from('orders').select('guest_email').eq('van_id', van.id).gte('created_at', lapsedCutoff).not('guest_email', 'is', null)
      const recentEmails = new Set((recentOrders ?? []).map((o: any) => o.guest_email))
      const lapsed = new Set((activeOrders ?? []).map((o: any) => o.guest_email).filter((e: string) => !recentEmails.has(e)))
      if (lapsed.size > 0) suggestions.push({ van: van.name, count: lapsed.size })
    }

    if (!suggestions.length) {
      await completeRun(admin, runId, { status: 'SKIPPED', actionTaken: 'no_suggestions' })
      return
    }

    const body = suggestions.map(s => `${s.count} customers ordered from ${s.van} in the last ${ACTIVE_WINDOW_DAYS} days but not in the last ${LAPSED_AFTER_DAYS} days.`).join('\n')
    const recipients = await getRecipients(admin, business.id, 'view_analytics')
    const result = await notify(admin, {
      businessId: business.id, automationType: 'marketing_suggestion', recipients,
      title: '💡 Marketing suggestion', body: `${body}\n\nSuggested action: create a campaign for these customers.`,
      category: 'marketing', priority: 'INFO', actionUrl: '/dashboard/marketing',
    })
    await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'notified', result: { suggestions, ...result } })
  } catch (e: any) {
    await completeRun(admin, runId, { status: 'FAILED', failureReason: e.message ?? 'unknown_error' })
  }
}
