// @ts-nocheck
// L25/L47 — the single read model the Integration Centre and Command
// Centre's integration-health tile both use. Never invents a health
// score (K7 precedent) — just the real connection statuses, last sync
// time, open failure counts and review-queue size.
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { PAYMENT_PROVIDER_INFO } from '@/lib/payments/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_integrations')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const [paymentConnections, accountingConnections, terminals, failedSyncJobs, needsReviewJobs, openReviewItems, recentWebhookErrors] = await Promise.all([
    admin.from('payment_provider_connections').select('id, provider, status, external_account_name, last_checked_at, last_error, connected_at').eq('business_id', ctx.businessId),
    admin.from('accounting_connections').select('id, provider, status, external_org_name, last_sync_at, last_checked_at, last_error, connected_at').eq('business_id', ctx.businessId),
    admin.from('payment_terminals').select('id, van_id, provider, label, status, last_seen_at').eq('business_id', ctx.businessId),
    admin.from('accounting_sync_jobs').select('id', { count: 'exact', head: true }).eq('business_id', ctx.businessId).eq('status', 'FAILED'),
    admin.from('accounting_sync_jobs').select('id', { count: 'exact', head: true }).eq('business_id', ctx.businessId).eq('status', 'NEEDS_REVIEW'),
    admin.from('reconciliation_review_items').select('id', { count: 'exact', head: true }).eq('business_id', ctx.businessId).eq('status', 'OPEN'),
    admin.from('provider_webhook_events').select('id', { count: 'exact', head: true }).eq('business_id', ctx.businessId).eq('status', 'FAILED'),
  ])

  return NextResponse.json({
    payment_providers: {
      connections: paymentConnections.data ?? [],
      // L6 — every candidate researched, shown even when unconnected, so
      // the Integration Centre can explain what's available without
      // implying any of them is active.
      candidates: PAYMENT_PROVIDER_INFO,
      customer_card_processing_active: (paymentConnections.data ?? []).some((c: any) => c.status === 'CONNECTED'),
    },
    accounting: { connections: accountingConnections.data ?? [] },
    terminals: terminals.data ?? [],
    sync_health: {
      failed_jobs: failedSyncJobs.count ?? 0,
      needs_review_jobs: needsReviewJobs.count ?? 0,
    },
    reconciliation: { open_review_items: openReviewItems.count ?? 0 },
    webhook_errors: recentWebhookErrors.count ?? 0,
  })
}
