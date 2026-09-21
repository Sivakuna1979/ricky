// @ts-nocheck
// L18 — the one shared implementation of "actually issue a provider
// refund", called from exactly two places: the human two-step confirm
// route (app/api/integrations/payments/refunds/[id]/confirm) and the AI
// safe-action confirm route (app/api/ai/actions/[id]/confirm, action_type
// 'confirm_provider_refund') — both require their own separate explicit
// authenticated confirmation before this ever runs; neither the AI nor a
// single click can reach this function on its own. Kept in one place so
// the two callers can never drift into inconsistent refund/bookkeeping
// behaviour.
import { createStripeRefund, toPence } from './stripeTerminal'
import { round2 } from '@/lib/finance/money'
import { logAuditEvent } from '@/lib/auditLog'
import { reverseLoyaltyForOrder } from '@/lib/crm/loyalty'

export class RefundExecutionError extends Error {
  constructor(message: string, public statusCode = 502) { super(message) }
}

export async function executeProviderRefund(admin: any, params: { refundId: string; businessId: string; userId: string; auditAction: string }) {
  const { data: refund } = await admin.from('provider_refunds').select('*, provider_transactions(*)').eq('id', params.refundId).eq('business_id', params.businessId).maybeSingle()
  if (!refund) throw new RefundExecutionError('refund_not_found', 404)
  if (refund.status !== 'PENDING') throw new RefundExecutionError('refund_already_handled', 409)

  const { data: claimed } = await admin.from('provider_refunds').update({ confirmed_by: params.userId }).eq('id', refund.id).eq('status', 'PENDING').is('confirmed_by', null).select('id').maybeSingle()
  if (!claimed) throw new RefundExecutionError('refund_already_being_processed', 409)

  if (refund.provider !== 'STRIPE_TERMINAL') {
    await admin.from('provider_refunds').update({ status: 'FAILED' }).eq('id', refund.id)
    throw new RefundExecutionError(`no_refund_implementation:${refund.provider}`, 501)
  }

  const txn = refund.provider_transactions
  const { data: connection } = await admin.from('payment_provider_connections').select('external_account_id, status').eq('id', txn.connection_id).maybeSingle()
  if (!connection || connection.status !== 'CONNECTED') {
    await admin.from('provider_refunds').update({ status: 'FAILED' }).eq('id', refund.id)
    throw new RefundExecutionError('no_active_payment_provider — no live payment provider is connected for this business, so nothing has been refunded.', 409)
  }

  try {
    const stripeRefund = await createStripeRefund(connection.external_account_id, {
      paymentIntentId: txn.provider_transaction_id, amountPence: toPence(refund.amount), reason: refund.reason,
    })

    const { data: bookkeepingRefund } = await admin.from('refunds').insert({
      business_id: params.businessId, order_id: txn.order_id, amount: refund.amount, reason: refund.reason,
      method: 'card', recorded_by: params.userId,
    }).select().single()

    const { data: priorSucceeded } = await admin.from('provider_refunds').select('amount').eq('provider_transaction_id', txn.id).eq('status', 'SUCCEEDED')
    const totalRefunded = round2((priorSucceeded ?? []).reduce((s: number, r: any) => s + r.amount, 0) + refund.amount)
    const newTxnStatus = totalRefunded >= txn.amount - 0.01 ? 'REFUNDED' : 'PARTIALLY_REFUNDED'

    await admin.from('provider_refunds').update({ status: 'SUCCEEDED', provider_refund_id: stripeRefund.id, refund_id: bookkeepingRefund?.id ?? null, updated_at: new Date().toISOString() }).eq('id', refund.id)
    await admin.from('provider_transactions').update({ status: newTxnStatus, updated_at: new Date().toISOString() }).eq('id', txn.id)

    if (txn.order_id && totalRefunded >= txn.amount - 0.01) {
      try { await reverseLoyaltyForOrder(admin, params.businessId, txn.order_id, 'Order fully refunded (card, via Stripe Terminal)') } catch (_e) {}
    }

    await logAuditEvent(admin, { actorId: params.userId, action: params.auditAction, entityType: 'provider_refunds', entityId: refund.id, newValues: { amount: refund.amount, stripe_refund_id: stripeRefund.id } })

    return { refund_id: refund.id, amount: refund.amount, status: 'SUCCEEDED' }
  } catch (e: any) {
    if (e instanceof RefundExecutionError) throw e
    await admin.from('provider_refunds').update({ status: 'FAILED', updated_at: new Date().toISOString() }).eq('id', refund.id)
    throw new RefundExecutionError('The refund could not be completed with Stripe — nothing was recorded.', 502)
  }
}
