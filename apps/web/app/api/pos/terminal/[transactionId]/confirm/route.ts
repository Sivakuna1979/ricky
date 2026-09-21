// @ts-nocheck
// L-B — re-verifies a Terminal payment directly with Stripe (never trusts
// the till's own JS SDK success callback alone) and, only on a genuine
// 'succeeded' status, progresses the order out of 'awaiting_payment'. The
// Connect webhook (app/api/webhooks/stripe-connect) does the exact same
// update independently — whichever arrives first wins, the second is a
// no-op via the `.eq('status', 'awaiting_payment')` guard, so a slow
// webhook can never re-open or double-progress an order this route
// already confirmed.
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { retrievePaymentIntent, fromPence } from '@/lib/payments/stripeTerminal'
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

  try {
    const intent = await retrievePaymentIntent(txn.payment_provider_connections.external_account_id, params.transactionId)

    if (intent.status === 'succeeded') {
      await upsertProviderTransaction(admin, {
        businessId: ctx.businessId, provider: 'STRIPE_TERMINAL', providerTransactionId: params.transactionId,
        status: 'SUCCEEDED', paymentMethodType: 'PROVIDER_VERIFIED_CARD', amount: fromPence(intent.amount), orderId: txn.order_id,
      })
      await admin.from('orders').update({ status: 'preparing', accepted_at: new Date().toISOString() }).eq('id', txn.order_id).eq('status', 'awaiting_payment')
      return NextResponse.json({ status: 'succeeded', order_id: txn.order_id })
    }

    if (['canceled', 'requires_payment_method'].includes(intent.status)) {
      await upsertProviderTransaction(admin, {
        businessId: ctx.businessId, provider: 'STRIPE_TERMINAL', providerTransactionId: params.transactionId,
        status: intent.status === 'canceled' ? 'CANCELLED' : 'FAILED', paymentMethodType: 'PROVIDER_VERIFIED_CARD', amount: fromPence(intent.amount), orderId: txn.order_id,
      })
      await admin.from('orders').update({ status: 'cancelled' }).eq('id', txn.order_id).eq('status', 'awaiting_payment')
      return NextResponse.json({ status: intent.status })
    }

    return NextResponse.json({ status: intent.status }) // still processing — client may poll again
  } catch (e: any) {
    return NextResponse.json({ error: 'Could not confirm the card payment status.' }, { status: 502 })
  }
}
