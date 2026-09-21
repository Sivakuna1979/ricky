// @ts-nocheck
// L50–L58 — FoodTaxi AI's payments/accounting tools. Every handler here is
// read-only except propose_provider_refund, which — exactly like
// propose_expense/propose_purchase_order — only ever creates a PENDING
// row for a human to confirm. The AI NEVER receives an OAuth token, API
// key, webhook secret, or card credential (none of that is queried by any
// tool below — connections are only ever read via the non-secret
// `*_connections` tables, never `*_secrets`), and it can never
// connect/disconnect a provider, change a payout destination, alter a
// mapping, or actually execute a refund — those are not tools at all.
import { hasPermission } from '@/lib/permissions'
import { getReviewQueue } from '@/lib/payments/reconciliation'
import { draftProviderRefund } from '@/lib/payments/transactions'

export const integrationsTools = [
  {
    name: 'get_integration_status',
    description: "Connection status for payment providers and accounting (Xero/QuickBooks) — \"is Xero connected\", \"is our card reader set up\". Never returns any token or secret.",
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasPermission(ctx.role, 'view_integrations')) return { error: "This account doesn't have permission to view integrations." }
      const [paymentConn, accountingConn] = await Promise.all([
        admin.from('payment_provider_connections').select('provider, status, last_error').eq('business_id', ctx.businessId),
        admin.from('accounting_connections').select('provider, status, last_sync_at, last_error').eq('business_id', ctx.businessId),
      ])
      return {
        payment_providers: paymentConn.data ?? [],
        accounting: accountingConn.data ?? [],
        note: 'No live customer card-payment provider is active on FoodTaxi today — all card processing for food orders is still staff-recorded labels only.',
      }
    },
  },
  {
    name: 'get_unmatched_payments',
    description: 'Open reconciliation review items — unmatched provider transactions, missing confirmations, amount mismatches, duplicate candidates, payout discrepancies. "What payments need reviewing".',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasPermission(ctx.role, 'view_integrations')) return { error: "This account doesn't have permission to view this." }
      const items = await getReviewQueue(admin, ctx.businessId, 'OPEN')
      return { open_items: items.length, items }
    },
  },
  {
    name: 'get_accounting_sync_status',
    description: 'Xero/QuickBooks sync job status — how many are synced/queued/failed/needing review, and when the last successful sync was. "Has Xero synced recently", "why did the last sync fail".',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasPermission(ctx.role, 'view_integrations')) return { error: "This account doesn't have permission to view this." }
      const { data: jobs } = await admin.from('accounting_sync_jobs').select('status, provider, job_type, last_error, updated_at').eq('business_id', ctx.businessId).order('updated_at', { ascending: false }).limit(50)
      const byStatus: Record<string, number> = {}
      for (const j of jobs ?? []) byStatus[j.status] = (byStatus[j.status] ?? 0) + 1
      return { counts: byStatus, recent: (jobs ?? []).slice(0, 10) }
    },
  },
  {
    name: 'propose_provider_refund',
    description: "Prepare a DRAFT provider refund request for the owner to review and confirm. Does NOT refund anything by itself, and cannot succeed at all unless a real payment provider is connected (none is today). Use only when the user explicitly asks to refund a card payment that was processed by a real payment provider (not a manual/cash refund — use propose_expense-style manual recording for those via the Finance Hub).",
    input_schema: {
      type: 'object',
      properties: { provider_transaction_id: { type: 'string', description: 'The provider_transactions row id (not the provider’s own transaction id).' }, amount: { type: 'number' }, reason: { type: 'string' } },
      required: ['provider_transaction_id', 'amount', 'reason'],
    },
    async handler(admin: any, ctx: any, args: any) {
      if (!hasPermission(ctx.role, 'manage_payment_integrations')) return { proposed: false, message: "This account doesn't have permission to request a provider refund." }

      const { data: txn } = await admin.from('provider_transactions').select('*').eq('id', args.provider_transaction_id).eq('business_id', ctx.businessId).maybeSingle()
      if (!txn) return { proposed: false, message: 'No matching provider transaction was found for this business.' }
      if (!['SUCCEEDED', 'PARTIALLY_REFUNDED'].includes(txn.status)) return { proposed: false, message: `This transaction is ${txn.status.toLowerCase()} and cannot be refunded.` }

      const idempotencyKey = `ai_refund:${txn.id}:${Math.round(Number(args.amount) * 100)}:${ctx.userId}`
      const { row: refund } = await draftProviderRefund(admin, {
        businessId: ctx.businessId, providerTransactionRowId: txn.id, provider: txn.provider,
        amount: args.amount, reason: args.reason, requestedBy: ctx.userId, idempotencyKey,
      })

      const { data: pending, error } = await admin.from('ai_pending_actions').insert({
        business_id: ctx.businessId, user_id: ctx.userId, action_type: 'confirm_provider_refund',
        params: { provider_refund_id: refund.id },
        expires_at: new Date(Date.now() + 30 * 60000).toISOString(),
      }).select('id').single()
      if (error) throw new Error('pending_action_create_failed')

      return {
        proposed: true, pending_action_id: pending.id, amount: refund.amount, provider: txn.provider,
        note: 'This is a DRAFT only. No money has moved. Confirming it in the app will only succeed once a real payment provider is connected for this business — none is today.',
      }
    },
  },
]
