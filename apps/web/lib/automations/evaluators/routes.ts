// @ts-nocheck
// G55 — end-of-route review. Event-triggered (called from
// lib/routes/sessions.ts's endRouteSession), not part of the hourly cron
// sweep in app/api/cron/automations — a route can end at any time of day,
// and there's nothing to "poll for due" the way a scheduled report has.
// Reuses Phase D's claimRun/notify exactly as G53 asks, so this is one
// more automation type, not a second parallel notification mechanism.
import { claimRun, completeRun, notify } from '../engine'
import { getRecipients } from '../recipients'
import { getRoutePerformance, getAnomalies } from '@/lib/routes/analytics'

export async function runEndOfRouteReview(admin: any, businessId: string, vanId: string, serviceDate: string) {
  const { data: business } = await admin.from('businesses').select('id, name').eq('id', businessId).maybeSingle()
  if (!business) return
  const { data: van } = await admin.from('vans').select('name').eq('id', vanId).maybeSingle()

  const runId = await claimRun(admin, businessId, 'end_of_route_review', `end_of_route_review:${businessId}:${vanId}:${serviceDate}`)
  if (!runId) return

  try {
    const perf = await getRoutePerformance(admin, businessId, { startDate: serviceDate, endDate: serviceDate, vanId })
    const anomaly = await getAnomalies(admin, businessId, vanId, serviceDate)

    const lines = [
      `💰 Revenue: £${perf.revenue.toFixed(2)}`,
      `📦 Orders: ${perf.orders} (avg £${perf.average_order_value.toFixed(2)})`,
    ]
    if (anomaly.has_data && anomaly.comparable_days >= 3) {
      const diff = anomaly.revenue_percent_difference
      lines.push(`📊 vs average of last ${anomaly.comparable_days} comparable days: £${anomaly.average_revenue_same_weekday.toFixed(2)} (${diff >= 0 ? '+' : ''}${diff}%)${anomaly.is_notable ? ' — notable difference' : ''}`)
    } else if (anomaly.has_data) {
      lines.push(`📊 Only ${anomaly.comparable_days} comparable day(s) of history so far — not enough to compare yet.`)
    }
    const body = lines.join('\n')

    const recipients = await getRecipients(admin, businessId, 'view_analytics')
    const result = await notify(admin, {
      businessId, automationType: 'end_of_route_review', recipients,
      title: `🏁 Route ended — ${van?.name ?? 'van'}`, body, category: 'reports', priority: 'INFO', actionUrl: '/dashboard/routes',
    })
    await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'notified', result: { ...result, lines } })
  } catch (e: any) {
    await completeRun(admin, runId, { status: 'FAILED', failureReason: e.message ?? 'unknown_error' })
  }
}
