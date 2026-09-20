// @ts-nocheck
// ============================================================================
// PHASE D — the single scheduled entry point for every automation (D29).
//
// Scheduling choice: Vercel Cron (vercel.json), not Supabase pg_cron and
// not the unrelated apps/youtube BullMQ queue — this is a Next.js app
// already deployed on Vercel, Vercel Cron needs no extra infrastructure,
// and FoodTaxi has no existing job-queue worker process to piggyback on
// (BullMQ is youtube-automation-specific, running in its own worker
// process — copying it in would mean standing up a whole new deployment
// target just for FoodTaxi's automation, for no benefit at this scale).
//
// Runs hourly (vercel.json: '0 * * * *'). Individual automations decide
// for themselves whether they're actually due right now — e.g. the daily
// briefing checks isDueNow(timezone, 8, 0) — so an hourly tick is enough
// resolution for every automation in this phase (D40: don't scan
// everything every minute) while each one still fires close to its
// configured time in the business's own timezone (D28).
//
// Every automation write goes through claimRun()'s UNIQUE(business_id,
// trigger_key) constraint first (D4/D3) — an hourly tick that catches the
// same "due" window twice, or Vercel retrying a slow invocation, cannot
// duplicate a notification, a draft PO, or a report.
//
// Tenant isolation (D35): every evaluator is called once per business,
// scoped to that business's own id throughout — nothing here loops over
// data without a business_id filter, and the one cross-business scan
// (event_tomorrow, see lib/automations/evaluators/events.ts) resolves and
// scopes to a single business before ever calling notify().
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { computeHasAccess } from '@/lib/subscriptionAccess'
import { runStockAutomations } from '@/lib/automations/evaluators/stock'
import { runHygieneAutomations } from '@/lib/automations/evaluators/hygiene'
import { runVehicleAutomations } from '@/lib/automations/evaluators/vehicle'
import { runStaffAutomations } from '@/lib/automations/evaluators/staff'
import { runDailyBriefing, runEndOfDaySummary, runWeeklySummary } from '@/lib/automations/evaluators/reports'
import { runMarketingSuggestions } from '@/lib/automations/evaluators/marketing'
import { runEventTomorrowReminders } from '@/lib/automations/evaluators/events'
import { runInvoiceDueReminders, runFinanceReviewDigest, runVatPeriodReminder, runDailyFinanceSummary } from '@/lib/automations/evaluators/finance'
import { runPromoExpiringReminder, runFeedbackRequests, runScheduledCampaigns } from '@/lib/automations/evaluators/crm'

export async function GET(req: NextRequest) {
  // Named exactly CRON_SECRET (not a FoodTaxi-specific name) because
  // that's the one env var name Vercel Cron automatically sends as
  // `Authorization: Bearer <value>` on every invocation — see
  // https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
  // apps/web is deployed as its own separate Vercel project from
  // apps/agent, so this does not collide with apps/agent's own
  // (unrelated) CRON_SECRET despite the shared variable name.
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = await createAdminClient()
  const { data: businesses, error } = await admin
    .from('businesses').select('id, name, timezone, subscriptions(status, grandfathered)')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: { business_id: string; ok: boolean; error?: string }[] = []

  for (const business of businesses ?? []) {
    const sub = (business.subscriptions as any)?.[0] ?? null
    if (!computeHasAccess(sub)) continue // automation is included in the subscription — skip lapsed businesses

    try {
      await runStockAutomations(admin, business)
      await runHygieneAutomations(admin, business)
      await runVehicleAutomations(admin, business)
      await runStaffAutomations(admin, business)
      await runDailyBriefing(admin, business)
      await runEndOfDaySummary(admin, business)
      await runWeeklySummary(admin, business)
      await runMarketingSuggestions(admin, business)
      await runInvoiceDueReminders(admin, business)
      await runFinanceReviewDigest(admin, business)
      await runVatPeriodReminder(admin, business)
      await runDailyFinanceSummary(admin, business)
      await runPromoExpiringReminder(admin, business)
      await runFeedbackRequests(admin, business)
      await runScheduledCampaigns(admin, business)
      results.push({ business_id: business.id, ok: true })
    } catch (e: any) {
      // One business's failure must never block the others.
      results.push({ business_id: business.id, ok: false, error: e.message ?? 'unknown_error' })
    }
  }

  try {
    await runEventTomorrowReminders(admin) // global scan, resolves + scopes per business internally
  } catch (e: any) {
    results.push({ business_id: 'event_tomorrow', ok: false, error: e.message ?? 'unknown_error' })
  }

  return NextResponse.json({ ran: results.length, failures: results.filter(r => !r.ok).length })
}
