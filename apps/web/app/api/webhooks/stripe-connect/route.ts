// @ts-nocheck
// ============================================================================
// L-B — Stripe CONNECT webhook. Deliberately a SEPARATE endpoint and a
// SEPARATE signing secret (STRIPE_CONNECT_WEBHOOK_SECRET) from the
// existing platform webhook (app/api/webhooks/stripe — STRIPE_WEBHOOK_SECRET,
// which handles ONLY the £19.99 subscription and £29.99 event fee and is
// completely untouched by this phase). Connect events always carry
// `event.account` (the connected business's Stripe account id) — every
// handler below re-derives the FoodTaxi business from that account id via
// payment_provider_connections, never from anything else in the payload,
// which is what keeps one business's events from ever being able to touch
// another business's orders/transactions (L24).
//
// Idempotent via the same shared provider_webhook_events table every
// Phase L provider uses (lib/payments/webhooks.ts) — a redelivered
// event.id is a genuine no-op, not reprocessed.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyConnectWebhookSignature, getAccountStatus, fromPence } from '@/lib/payments/stripeTerminal'
import { claimWebhookEvent, markWebhookEvent } from '@/lib/payments/webhooks'
import { upsertProviderTransaction } from '@/lib/payments/transactions'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: any
  try {
    event = verifyConnectWebhookSignature(body, signature)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = await createAdminClient()
  const accountId: string | null = event.account ?? null

  // Resolve which FoodTaxi business owns this connected account BEFORE
  // touching anything — an event for an account we don't recognise (e.g.
  // a stale/disconnected one) is safely ignored, never guessed.
  const { data: connection } = accountId
    ? await admin.from('payment_provider_connections').select('id, business_id, external_account_id').eq('provider', 'STRIPE_TERMINAL').eq('external_account_id', accountId).maybeSingle()
    : { data: null }

  const claim = await claimWebhookEvent(admin, {
    providerKind: 'PAYMENT', provider: 'STRIPE_TERMINAL', eventId: event.id, eventType: event.type, businessId: connection?.business_id ?? null,
  })
  if (!claim.claimed) return NextResponse.json({ received: true, duplicate: true })

  try {
    if (!connection) {
      await markWebhookEvent(admin, claim.id, 'IGNORED', 'no matching connection for this account')
      return NextResponse.json({ received: true })
    }

    switch (event.type) {
      case 'account.updated': {
        const result = await getAccountStatus(accountId!)
        await admin.from('payment_provider_connections').update({
          status: result.status, last_checked_at: new Date().toISOString(), last_error: result.disabledReason,
          connected_at: result.status === 'CONNECTED' ? new Date().toISOString() : undefined, updated_at: new Date().toISOString(),
        }).eq('id', connection.id)
        break
      }

      case 'payment_intent.succeeded': {
        const intent = event.data.object
        const orderId = intent.metadata?.order_id
        await upsertProviderTransaction(admin, {
          businessId: connection.business_id, provider: 'STRIPE_TERMINAL', providerTransactionId: intent.id,
          status: 'SUCCEEDED', paymentMethodType: 'PROVIDER_VERIFIED_CARD', amount: fromPence(intent.amount), orderId,
        })
        if (orderId) {
          // Idempotency against the POS till's own /confirm route (L-B):
          // whichever of the two gets here first wins; this guard means
          // the other is always a safe no-op, never a double-progression.
          await admin.from('orders').update({ status: 'preparing', accepted_at: new Date().toISOString() }).eq('id', orderId).eq('status', 'awaiting_payment')
        }
        break
      }

      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled': {
        const intent = event.data.object
        const orderId = intent.metadata?.order_id
        await upsertProviderTransaction(admin, {
          businessId: connection.business_id, provider: 'STRIPE_TERMINAL', providerTransactionId: intent.id,
          status: event.type === 'payment_intent.canceled' ? 'CANCELLED' : 'FAILED', paymentMethodType: 'PROVIDER_VERIFIED_CARD', amount: fromPence(intent.amount), orderId,
        })
        if (orderId) await admin.from('orders').update({ status: 'cancelled' }).eq('id', orderId).eq('status', 'awaiting_payment')
        break
      }

      case 'charge.refunded': {
        // Reconciliation safety net only — the primary refund record
        // (the `refunds` bookkeeping row + provider_refunds.status update)
        // is written synchronously by the confirm-refund route
        // (app/api/integrations/payments/refunds/[id]/confirm) when it
        // calls Stripe directly. This just catches the rare case where
        // that route's own DB write was lost after Stripe's call
        // succeeded — never creates a second `refunds` row.
        const charge = event.data.object
        const paymentIntentId = charge.payment_intent
        const { data: txn } = await admin.from('provider_transactions').select('id').eq('provider', 'STRIPE_TERMINAL').eq('provider_transaction_id', paymentIntentId).maybeSingle()
        if (txn) {
          const { data: pendingRefund } = await admin.from('provider_refunds').select('id').eq('provider_transaction_id', txn.id).eq('status', 'PENDING').maybeSingle()
          if (pendingRefund) {
            await admin.from('provider_refunds').update({ status: 'SUCCEEDED', updated_at: new Date().toISOString() }).eq('id', pendingRefund.id)
          }
          const refundStatus = charge.amount_refunded >= charge.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED'
          await admin.from('provider_transactions').update({ status: refundStatus, updated_at: new Date().toISOString() }).eq('id', txn.id)
        }
        break
      }
    }

    await markWebhookEvent(admin, claim.id, 'PROCESSED')
    return NextResponse.json({ received: true })
  } catch (e: any) {
    await markWebhookEvent(admin, claim.id, 'FAILED', e.message ?? 'unknown_error')
    // Non-200 so Stripe retries delivery rather than us silently dropping
    // an unprocessed event.
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
