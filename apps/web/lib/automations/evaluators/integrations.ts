// @ts-nocheck
// L47/L49 — integration health alerts, reusing Phase D's exact
// engine/notify/settings pattern rather than a parallel alerting system.
// Also where accounting sync jobs actually get processed and the
// reconciliation sweep actually runs — both piggyback on the existing
// hourly cron tick (D29) instead of new scheduling infrastructure.
import { claimRun, completeRun, notify } from '../engine'
import { getResolvedSettings } from '../settings'
import { getRecipients } from '../recipients'
import { todayDateInTimezone } from '../timezone'
import { processDueSyncJobs } from '@/lib/accounting/syncEngine'
import { runReconciliationSweep } from '@/lib/payments/reconciliation'

// L43 — actually advances the accounting sync queue. Not gated by an
// automation-settings toggle (it's core infrastructure, not an alert) —
// always runs, once per business per tick.
export async function runAccountingSync(admin: any, business: { id: string }) {
  const { data: connections } = await admin.from('accounting_connections').select('id').eq('business_id', business.id).eq('status', 'CONNECTED')
  if (!connections?.length) return
  await processDueSyncJobs(admin, 10)
}

// L46 — the reconciliation sweep. Same reasoning as sync: infrastructure,
// runs unconditionally (only ever touches this business's own rows).
export async function runReconciliation(admin: any, business: { id: string }) {
  await runReconciliationSweep(admin, business.id)
}

// L47/L49 — one daily digest of open integration-health issues (failed
// syncs, needs-review jobs, open reconciliation items, ERROR/
// ACTION_REQUIRED connections) — never one alert per item, same "digest
// not spam" reasoning as Phase H's finance_review_digest.
export async function runIntegrationHealthDigest(admin: any, business: { id: string; timezone: string; name: string }) {
  const settings = await getResolvedSettings(admin, business.id)
  if (!settings.integration_sync_issue.enabled) return
  const date = todayDateInTimezone(business.timezone)

  const [failedJobs, needsReview, openReview, badConnections] = await Promise.all([
    admin.from('accounting_sync_jobs').select('id', { count: 'exact', head: true }).eq('business_id', business.id).eq('status', 'FAILED'),
    admin.from('accounting_sync_jobs').select('id', { count: 'exact', head: true }).eq('business_id', business.id).eq('status', 'NEEDS_REVIEW'),
    admin.from('reconciliation_review_items').select('id', { count: 'exact', head: true }).eq('business_id', business.id).eq('status', 'OPEN'),
    admin.from('accounting_connections').select('provider').eq('business_id', business.id).in('status', ['ERROR', 'ACTION_REQUIRED']),
  ])

  const total = (failedJobs.count ?? 0) + (needsReview.count ?? 0) + (openReview.count ?? 0) + (badConnections.data?.length ?? 0)
  if (total === 0) return

  const runId = await claimRun(admin, business.id, 'integration_sync_issue', `integration_sync_issue:${date}`)
  if (!runId) return

  const recipients = await getRecipients(admin, business.id, 'view_integrations')
  const parts = []
  if (needsReview.count) parts.push(`${needsReview.count} sync job(s) need review`)
  if (failedJobs.count) parts.push(`${failedJobs.count} sync job(s) failed and will retry`)
  if (openReview.count) parts.push(`${openReview.count} reconciliation item(s) open`)
  if (badConnections.data?.length) parts.push(`${badConnections.data.map((c: any) => c.provider).join(', ')} connection needs attention`)

  const result = await notify(admin, {
    businessId: business.id, automationType: 'integration_sync_issue', recipients,
    title: `🔌 Integration health — ${total} item${total === 1 ? '' : 's'} need attention`,
    body: parts.join('. ') + '.', category: 'reports', priority: 'ACTION', actionUrl: '/dashboard/integrations',
  })
  await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'notified', result })
}
