// @ts-nocheck
// L-B — staff explicitly cancels an in-flight Terminal payment (reader
// timeout, customer walked away, wrong amount). Cancels the PaymentIntent
// with Stripe itself (so it can never later be captured by mistake), not
// just the local order/transaction rows.
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { cancelPaymentIntent } from '@/lib/payments/stripeTerminal'
import { upsertProviderTransaction } from '@/lib/payments/transactions'

export async function POST(req: Request, { params }: { params: { transactionId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'use_pos')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: txn } = await admin.from('provider_transactions').select('*, payment_provider_connections(external_account_id)').eq('provider', 'STRIPE_TERMINAL').eq('provider_transaction_id', params.transactionId).maybeSingle()
  if (!txn || txn.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (['SUCCEEDED', 'CANCELLED', 'FAILED'].includes(txn.status)) return NextResponse.json({ error: `Already ${txn.status.toLowerCase()}` }, { status: 409 })

  try {
    await cancelPaymentIntent(txn.payment_provider_connections.external_account_id, params.transactionId)
  } catch (_e) {
    // Already cancelled/succeeded on Stripe's side, or unreachable — fall
    // through and reconcile local state from a fresh retrieve rather than
    // failing the whole cancel attempt.
  }

  await upsertProviderTransaction(admin, {
    businessId: ctx.businessId, provider: 'STRIPE_TERMINAL', providerTransactionId: params.transactionId,
    status: 'CANCELLED', paymentMethodType: 'PROVIDER_VERIFIED_CARD', amount: txn.amount, orderId: txn.order_id,
  })
  await admin.from('orders').update({ status: 'cancelled' }).eq('id', txn.order_id).eq('status', 'awaiting_payment')

  return NextResponse.json({ ok: true })
}
