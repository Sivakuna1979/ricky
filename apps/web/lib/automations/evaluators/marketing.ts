// @ts-nocheck
// D22, D23 — marketing SUGGESTIONS only. Never sends anything itself; it
// creates a notification with a count and a link to the CRM campaigns
// page, where the owner reviews and sends manually. Runs weekly, same
// cadence family as the weekly summary.
//
// I78 ("lapsed-customer audience ready") is this exact same automation —
// no separate one was added. Fixed during Phase I to use the same
// lapsed definition every other CRM surface uses
// (lib/crm/segments.ts's computeSegmentMembership) instead of its own
// bespoke van-by-van email-diff calculation, so this notification's
// count can never disagree with the Customers dashboard's own "Lapsed"
// segment count.
import { claimRun, completeRun, notify } from '../engine'
import { getResolvedSettings } from '../settings'
import { getRecipients } from '../recipients'
import { nowInTimezone, isDueNow, isoWeekKey } from '../timezone'
import { getCustomerAggregates, computeSegmentMembership } from '@/lib/crm/segments'

const LAPSED_AFTER_DAYS = 21

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
    const { data: vans } = await admin.from('vans').select('id').eq('business_id', business.id)
    const vanIds = (vans ?? []).map((v: any) => v.id)
    const aggregates = await getCustomerAggregates(admin, business.id, vanIds)
    let lapsedCount = 0
    for (const agg of aggregates.values()) if (computeSegmentMembership(agg, 'lapsed', { lapsedDays: LAPSED_AFTER_DAYS })) lapsedCount++

    if (!lapsedCount) {
      await completeRun(admin, runId, { status: 'SKIPPED', actionTaken: 'no_suggestions' })
      return
    }

    const body = `${lapsedCount} customer${lapsedCount === 1 ? '' : 's'} haven't ordered in the last ${LAPSED_AFTER_DAYS} days.\n\nSuggested action: create a win-back campaign for the "Lapsed" segment.`
    const recipients = await getRecipients(admin, business.id, 'view_marketing_analytics')
    const result = await notify(admin, {
      businessId: business.id, automationType: 'marketing_suggestion', recipients,
      title: '💡 Marketing suggestion', body,
      category: 'marketing', priority: 'INFO', actionUrl: '/dashboard/customers',
    })
    await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'notified', result: { lapsed_count: lapsedCount, ...result } })
  } catch (e: any) {
    await completeRun(admin, runId, { status: 'FAILED', failureReason: e.message ?? 'unknown_error' })
  }
}
