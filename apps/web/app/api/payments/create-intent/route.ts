// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { order_id } = await req.json()

  const { data: order } = await supabase
    .from('orders')
    .select('*, vans(businesses(stripe_account_id))')
    .eq('id', order_id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const amountPence = Math.round(order.total * 100)
  const platformFeePercent = 0.025 // 2.5% platform fee

  const params: Stripe.PaymentIntentCreateParams = {
    amount: amountPence,
    currency: 'gbp',
    metadata: { order_id, van_id: order.van_id },
  }

  const stripeAccountId = (order.vans as any)?.businesses?.stripe_account_id
  if (stripeAccountId) {
    params.application_fee_amount = Math.round(amountPence * platformFeePercent)
    params.transfer_data = { destination: stripeAccountId }
  }

  const intent = await stripe.paymentIntents.create(params)

  // Record payment attempt
  await supabase.from('payments').insert({
    order_id,
    stripe_payment_intent_id: intent.id,
    amount: order.total,
    currency: 'gbp',
    status: 'created',
    payment_method: order.payment_method,
  })

  return NextResponse.json({ client_secret: intent.client_secret })
}
