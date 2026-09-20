// @ts-nocheck
// D24, D25 — event preparation reminder for a business's own confirmed
// booking, the day before. Does not touch the £29.99 booking fee flow.
//
// Architectural note: unlike every other evaluator, this one is NOT called
// once per business from the cron loop. event_requests/event_applications
// are a cross-business marketplace table (admin_status/customer_status
// workflow, RLS is super-admin-only — see Phase A) — a confirmed
// application is linked to a business only loosely, by
// `van_owner_email` matching that business's contact email. So this scans
// tomorrow's confirmed applications once, resolves each to its business,
// and only then applies that business's own automation_settings before
// notifying — every notification still only reaches the one business it
// resolves to (tenant isolation preserved), it's just discovered
// differently. "New event enquiry" (D24) was considered but not built as
// a per-business automation: enquiries aren't business-scoped at
// creation — they're published to the marketplace by super admin — so
// there's no single business to notify about a brand-new enquiry; that
// stays an admin-side concern, already covered by the existing
// /admin/events tooling.
//
// D25 (meal-quantity preparation summary): NOT built. event_requests has
// no structured per-item quantity data (only num_guests/food_type free
// text) — nothing to report without inventing numbers, which the brief
// explicitly forbids. The reminder below uses only the real fields that
// exist.
import { claimRun, completeRun, notify } from '../engine'
import { getResolvedSettings } from '../settings'
import { getRecipients } from '../recipients'
import { todayDateInTimezone } from '../timezone'

const CONFIRMED_STATUSES = ['confirmed', 'awaiting_deposit']

export async function runEventTomorrowReminders(admin: any) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  const { data: events } = await admin
    .from('event_requests')
    .select('id, event_date, event_location, event_type, num_guests, food_type, notes')
    .eq('event_date', tomorrow)
    .in('admin_status', CONFIRMED_STATUSES)
  if (!events?.length) return

  const eventIds = events.map((e: any) => e.id)
  const { data: applications } = await admin
    .from('event_applications').select('event_id, van_owner_email, business_name, status')
    .in('event_id', eventIds).eq('status', 'confirmed')

  for (const app of applications ?? []) {
    if (!app.van_owner_email) continue
    const event = events.find((e: any) => e.id === app.event_id)
    if (!event) continue

    const { data: business } = await admin.from('businesses').select('id, name, timezone').eq('email', app.van_owner_email).maybeSingle()
    if (!business) continue // no FoodTaxi business account matches this application's contact email

    const settings = await getResolvedSettings(admin, business.id)
    if (!settings.event_tomorrow.enabled) continue

    const date = todayDateInTimezone(business.timezone ?? 'Europe/London')
    const runId = await claimRun(admin, business.id, 'event_tomorrow', `event_tomorrow:${event.id}:${date}`)
    if (!runId) continue

    const details = [
      event.event_location ? `📍 ${event.event_location}` : null,
      event.event_type ? `Type: ${event.event_type}` : null,
      event.num_guests ? `Expected guests: ${event.num_guests}` : null,
      event.food_type ? `Food: ${event.food_type}` : null,
      event.notes ? `Notes: ${event.notes}` : null,
    ].filter(Boolean).join('\n')

    const recipients = await getRecipients(admin, business.id, 'view_orders')
    const result = await notify(admin, {
      businessId: business.id, automationType: 'event_tomorrow', recipients,
      title: '🎉 Event tomorrow', body: details || 'You have a confirmed event tomorrow.',
      category: 'events', priority: 'IMPORTANT', actionUrl: '/van/events',
    })
    await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'notified', result })
  }
}
