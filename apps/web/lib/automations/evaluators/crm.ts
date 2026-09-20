// @ts-nocheck
// I78 — CRM/loyalty/marketing automations, reusing Phase D's engine
// exactly. Scheduled-campaign sending here shares the exact same
// confirmAndSendCampaign() the manual "Confirm & Send" button uses
// (lib/crm/campaigns.ts) — one send implementation, two triggers.
import { claimRun, completeRun, notify } from '../engine'
import { getResolvedSettings } from '../settings'
import { getRecipients } from '../recipients'
import { todayDateInTimezone } from '../timezone'
import { confirmAndSendCampaign } from '@/lib/crm/campaigns'
import { markFeedbackRequested } from '@/lib/crm/feedback'
import { sendAutomationEmail } from '@/lib/notify/channels'

const THRESHOLD_DAYS = 3

function daysUntil(date: string, today: string) {
  return Math.round((new Date(date).getTime() - new Date(today).getTime()) / 86400000)
}

// I20/I78 — a promo code ending in 3 days gets one reminder to staff
// (exact-day threshold, the same pattern as Phase D's vehicle reminders —
// never repeats once past that single day).
export async function runPromoExpiringReminder(admin: any, business: { id: string; timezone: string; name: string }) {
  const settings = await getResolvedSettings(admin, business.id)
  if (!settings.promo_expiring.enabled) return
  const today = todayDateInTimezone(business.timezone)

  const { data: promos } = await admin.from('promo_codes').select('id, code, ends_at').eq('business_id', business.id).eq('is_active', true).not('ends_at', 'is', null)
  for (const p of promos ?? []) {
    const endsDate = p.ends_at.slice(0, 10)
    if (daysUntil(endsDate, today) !== THRESHOLD_DAYS) continue
    const runId = await claimRun(admin, business.id, 'promo_expiring', `promo_expiring:${p.id}:${today}`)
    if (!runId) continue
    const recipients = await getRecipients(admin, business.id, 'manage_promotions')
    const result = await notify(admin, {
      businessId: business.id, automationType: 'promo_expiring', recipients,
      title: `📣 Promo code "${p.code}" ends in ${THRESHOLD_DAYS} days`, body: `Ends ${endsDate}.`,
      category: 'marketing', priority: 'INFO', actionUrl: '/dashboard/customers',
    })
    await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'notified', result })
  }
}

// I45 — one feedback request per order, a few hours after collection
// (a 2-6 hour window so it's not sent the instant they walk away, but
// not so late it's forgotten), only when the order has an email and the
// business has this on. Classed as operational/transactional to the
// specific order rather than a marketing send (I80), so it does not
// check marketing_email_opt_in — but is still capped to once ever per
// order via feedback_requests' UNIQUE(order_id), so nobody is asked
// twice for the same order.
export async function runFeedbackRequests(admin: any, business: { id: string; timezone: string; name: string }) {
  const settings = await getResolvedSettings(admin, business.id)
  if (!settings.feedback_request.enabled) return

  const { data: vans } = await admin.from('vans').select('id').eq('business_id', business.id)
  const vanIds = (vans ?? []).map((v: any) => v.id)
  if (!vanIds.length) return

  const windowStart = new Date(Date.now() - 6 * 3600000).toISOString()
  const windowEnd = new Date(Date.now() - 2 * 3600000).toISOString()
  const { data: orders } = await admin.from('orders').select('id, guest_email, guest_name, order_number').in('van_id', vanIds)
    .eq('status', 'collected').gte('collected_at', windowStart).lte('collected_at', windowEnd).not('guest_email', 'is', null)

  for (const order of orders ?? []) {
    const claimed = await markFeedbackRequested(admin, business.id, order.id)
    if (!claimed) continue // already requested for this order
    await sendAutomationEmail(order.guest_email, `How was your order from ${business.name}?`,
      `<p>Hi ${order.guest_name || ''},</p><p>We'd love to know how order ${order.order_number} went.</p><p><a href="https://food-taxi.vercel.app/feedback/${order.id}">Leave feedback</a></p>`)
  }
}

// I37 — sends every campaign whose scheduled_for has passed, using the
// exact same confirmAndSendCampaign() the manual button calls.
export async function runScheduledCampaigns(admin: any, business: { id: string }) {
  const { data: due } = await admin.from('campaigns').select('id').eq('business_id', business.id).eq('status', 'SCHEDULED').lte('scheduled_for', new Date().toISOString())
  for (const c of due ?? []) {
    try { await confirmAndSendCampaign(admin, business.id, c.id) } catch (_e) {}
  }
}
