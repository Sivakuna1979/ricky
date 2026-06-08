// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { business_id, plan_id, billing_period } = await req.json()

  // Get plan
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', plan_id)
    .single()

  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  const stripePrice = billing_period === 'yearly'
    ? plan.stripe_price_id_yearly
    : plan.stripe_price_id_monthly

  if (!stripePrice) return NextResponse.json({ error: 'Stripe price not configured' }, { status: 500 })

  // Get or create Stripe customer
  const { data: business } = await supabase
    .from('businesses')
    .select('stripe_customer_id, email, name')
    .eq('id', business_id)
    .single()

  let customerId = business?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: business?.email ?? user.email,
      name: business?.name,
      metadata: { business_id },
    })
    customerId = customer.id
    await supabase.from('businesses').update({ stripe_customer_id: customerId }).eq('id', business_id)
  }

  // Create Stripe subscription
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: stripePrice }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
  })

  // Update our subscription record
  await supabase
    .from('subscriptions')
    .update({
      stripe_subscription_id: subscription.id,
      plan_id,
      status: 'active',
    })
    .eq('business_id', business_id)

  const invoice = subscription.latest_invoice as Stripe.Invoice
  const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent

  return NextResponse.json({
    subscription_id: subscription.id,
    client_secret: paymentIntent?.client_secret,
  })
}
