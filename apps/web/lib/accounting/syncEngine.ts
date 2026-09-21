// @ts-nocheck
// L38/L43 — the background accounting sync engine. `accounting_sync_jobs`
// is the queue; this file is the only code that transitions a job's
// status. Backoff/dead-letter (L44): each retry doubles the delay
// (5m, 10m, 20m, 40m, 80m) and a job that's failed MAX_ATTEMPTS times
// moves to NEEDS_REVIEW instead of retrying forever — surfaced in the
// review queue (L45) and Command Centre integration health (L47), never
// silently dropped.
import { getAccountingTokens, storeAccountingTokens } from '@/lib/integrations/secrets'
import { refreshXeroToken, getXeroTenants, pushXeroSalesSummary, pushXeroExpense } from './xero'
import { refreshQuickBooksToken, pushQuickBooksSalesSummary, pushQuickBooksExpense } from './quickbooks'
import { requireAccountMapping, MappingRequiredError } from './mapping'
import { round2 } from '@/lib/finance/money'

const MAX_ATTEMPTS = 5
const BASE_BACKOFF_MINUTES = 5

// L38 — enqueue is idempotent by construction: `idempotencyKey` should
// encode the underlying fact being synced (e.g.
// `xero:SALES_SUMMARY:${businessId}:${vanId}:${date}`) so re-queueing the
// same fact after a page refresh, a retried cron tick, or a duplicate
// trigger never creates a second job — the unique constraint on
// accounting_sync_jobs.idempotency_key makes a duplicate insert a no-op.
export async function enqueueSyncJob(admin: any, params: {
  businessId: string; connectionId: string; provider: string; jobType: string; sourceRef: string; idempotencyKey: string
}) {
  const { data: existing } = await admin.from('accounting_sync_jobs').select('id, status').eq('idempotency_key', params.idempotencyKey).maybeSingle()
  if (existing) return { id: existing.id, created: false, status: existing.status }

  const { data: inserted, error } = await admin.from('accounting_sync_jobs').insert({
    business_id: params.businessId, connection_id: params.connectionId, provider: params.provider,
    job_type: params.jobType, source_ref: params.sourceRef, idempotency_key: params.idempotencyKey, status: 'QUEUED',
  }).select('id').single()
  if (error) {
    if (error.code === '23505') return enqueueSyncJob(admin, params)
    throw error
  }
  return { id: inserted.id, created: true, status: 'QUEUED' }
}

async function getValidAccessToken(admin: any, connection: any) {
  const tokens = await getAccountingTokens(admin, connection.id)
  if (!tokens) throw new Error('not_connected')

  const expiresAt = tokens.token_expires_at ? new Date(tokens.token_expires_at).getTime() : 0
  if (expiresAt - Date.now() > 60000) return tokens.access_token

  // Expired/expiring — refresh, or mark ACTION_REQUIRED if the refresh
  // itself fails (a revoked/expired refresh token means only a human
  // reconnecting can fix this, never an automatic retry loop).
  try {
    const refreshed = connection.provider === 'XERO'
      ? await refreshXeroToken(tokens.refresh_token)
      : await refreshQuickBooksToken(tokens.refresh_token)
    await storeAccountingTokens(admin, connection.id, refreshed)
    return refreshed.accessToken
  } catch (e) {
    await admin.from('accounting_connections').update({ status: 'ACTION_REQUIRED', last_error: 'Token refresh failed — please reconnect.' }).eq('id', connection.id)
    throw e
  }
}

// Processes one QUEUED/retry-due job. Never throws — always leaves the job
// in a terminal-for-this-attempt state (SYNCED/QUEUED-with-later-retry/
// NEEDS_REVIEW) so a caller looping over many jobs never has one bad job
// abort the whole batch.
export async function processSyncJob(admin: any, job: any) {
  await admin.from('accounting_sync_jobs').update({ status: 'SYNCING' }).eq('id', job.id)

  try {
    const { data: connection } = await admin.from('accounting_connections').select('*').eq('id', job.connection_id).maybeSingle()
    if (!connection || connection.status !== 'CONNECTED') throw new Error('connection_not_active')

    const externalId = await runSync(admin, connection, job)

    await admin.from('accounting_sync_jobs').update({ status: 'SYNCED', external_id: externalId, last_error: null, updated_at: new Date().toISOString() }).eq('id', job.id)
    return { ok: true, status: 'SYNCED' }
  } catch (e: any) {
    if (e instanceof MappingRequiredError) {
      await admin.from('accounting_sync_jobs').update({
        status: 'NEEDS_REVIEW', last_error: `No ${e.provider} account mapping set for category "${e.category}".`, updated_at: new Date().toISOString(),
      }).eq('id', job.id)
      return { ok: false, status: 'NEEDS_REVIEW' }
    }

    const attempts = (job.attempts ?? 0) + 1
    if (attempts >= MAX_ATTEMPTS) {
      await admin.from('accounting_sync_jobs').update({
        status: 'NEEDS_REVIEW', attempts, last_error: e.message ?? 'sync_failed', updated_at: new Date().toISOString(),
      }).eq('id', job.id)
      return { ok: false, status: 'NEEDS_REVIEW' }
    }

    const backoffMinutes = BASE_BACKOFF_MINUTES * Math.pow(2, attempts - 1)
    await admin.from('accounting_sync_jobs').update({
      status: 'FAILED', attempts, last_error: e.message ?? 'sync_failed',
      next_retry_at: new Date(Date.now() + backoffMinutes * 60000).toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', job.id)
    return { ok: false, status: 'FAILED' }
  }
}

async function runSync(admin: any, connection: any, job: any): Promise<string> {
  const accessToken = await getValidAccessToken(admin, connection)

  if (job.job_type === 'SALES_SUMMARY') {
    const summary = JSON.parse(job.source_ref)
    const mapping = await requireAccountMapping(admin, job.business_id, job.provider, 'sales')
    const reference = `foodtaxi-sales-${summary.van_id}-${summary.date}`
    if (job.provider === 'XERO') {
      const tenants = await getXeroTenants(accessToken)
      const tenantId = connection.external_org_id ?? tenants[0]?.tenantId
      return await pushXeroSalesSummary(accessToken, tenantId, {
        contactName: 'FoodTaxi daily sales', date: summary.date, description: `Van sales summary — ${summary.date}`,
        amount: round2(summary.total), accountCode: mapping.external_account_id, taxType: mapping.tax_code ?? 'NONE', reference,
      })
    }
    return await pushQuickBooksSalesSummary(accessToken, connection.external_org_id, {
      date: summary.date, description: `Van sales summary — ${summary.date}`, amount: round2(summary.total),
      accountId: mapping.external_account_id, taxCodeId: mapping.tax_code ?? undefined, reference,
    })
  }

  if (job.job_type === 'EXPENSE') {
    const expense = JSON.parse(job.source_ref)
    const mapping = await requireAccountMapping(admin, job.business_id, job.provider, expense.category)
    const reference = `foodtaxi-expense-${expense.id}`
    if (job.provider === 'XERO') {
      const tenants = await getXeroTenants(accessToken)
      const tenantId = connection.external_org_id ?? tenants[0]?.tenantId
      return await pushXeroExpense(accessToken, tenantId, {
        contactName: expense.supplier_name ?? 'Supplier', date: expense.expense_date, description: expense.description,
        amount: round2(expense.gross_amount), accountCode: mapping.external_account_id, taxType: mapping.tax_code ?? 'NONE', reference,
      })
    }
    return await pushQuickBooksExpense(accessToken, connection.external_org_id, {
      date: expense.expense_date, description: expense.description, amount: round2(expense.gross_amount),
      accountId: mapping.external_account_id, taxCodeId: mapping.tax_code ?? undefined, reference,
    })
  }

  // SUPPLIER_INVOICE / CUSTOMER_INVOICE / REFUND — same shape as EXPENSE,
  // deliberately not yet wired to a live source (no UI trigger creates
  // these job types in this pass) since Phase L's conservative sync scope
  // (L36) prioritises the daily/van sales summary and expenses first. The
  // engine supports them structurally; enqueueSyncJob() accepts any of the
  // job_type values the migration allows.
  throw new Error(`unsupported_job_type:${job.job_type}`)
}

// L43 — processes every due job across every business, called from the
// existing Vercel Cron entry point (app/api/cron/automations) so no new
// scheduling infrastructure is introduced.
export async function processDueSyncJobs(admin: any, limit = 25) {
  const { data: jobs } = await admin.from('accounting_sync_jobs').select('*').in('status', ['QUEUED', 'FAILED']).lte('next_retry_at', new Date().toISOString()).order('created_at', { ascending: true }).limit(limit)
  const results = []
  for (const job of jobs ?? []) {
    results.push({ id: job.id, ...(await processSyncJob(admin, job)) })
  }
  return results
}
