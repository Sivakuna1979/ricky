// @ts-nocheck
// ============================================================================
// ✅ PHASE B — FoodTaxi Business subscription checkout. Starts (or resumes)
// the £19.99/month subscription with a 3-day free trial via Stripe Checkout.
// Business → FoodTaxi → Stripe, same "simple mode" pattern as the working
// £29.99 event booking fee flow (app/api/events/pay/route.ts) — no Connect.
//
// business_id is never trusted from the request body — it is always derived
// server-side from the authenticated user's own business (Phase B25).
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { FOODTAXI_TRIAL_DAYS, STRIPE_FOODTAXI_MONTHLY_PRICE_ID } from '@/lib/subscriptionConfig'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-06-20' })
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://food-taxi.vercel.app'

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Payments not configured yet — add STRIPE_SECRET_KEY in Vercel.' }, { status: 503 })
    }
    if (!STRIPE_FOODTAXI_MONTHLY_PRICE_ID) {
      return NextResponse.json({ error: 'Subscription price not configured yet — add STRIPE_FOODTAXI_MONTHLY_PRICE_ID in Vercel.' }, { status: 503 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    if (!userData) return NextResponse.json({ error: 'User profile not found' }, { status: 404 })

    const admin = await createAdminClient()
    const { data: business } = await admin
      .from('businesses')
      .select('id, name, email, stripe_customer_id')
      .eq('owner_id', userData.id)
      .maybeSingle()
    if (!business) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

    const { data: plan } = await admin
      .from('subscription_plans').select('id').eq('name', 'FoodTaxi Business').maybeSingle()

    const { data: existingSub } = await admin
      .from('subscriptions').select('id, status, grandfathered, stripe_customer_id, stripe_subscription_id').eq('business_id', business.id).maybeSingle()

    // A grandfathered business's status is a leftover value, not a real
    // Stripe subscription — it must still be able to start real billing.
    const hasRealActiveSubscription = !existingSub?.grandfathered && (existingSub?.status === 'active' || existingSub?.status === 'trialing')
    if (hasRealActiveSubscription) {
      return NextResponse.json({ error: 'A FoodTaxi subscription is already active for this business.' }, { status: 409 })
    }

    let customerId = existingSub?.stripe_customer_id || business.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: business.email ?? user.email,
        name: business.name,
        metadata: { business_id: business.id },
      })
      customerId = customer.id
      await admin.from('businesses').update({ stripe_customer_id: customerId }).eq('id', business.id)
    }

    // Never grant a second free trial via Checkout if this customer has
    // already had a FoodTaxi subscription before (cancelled and resubscribing).
    const hasHadSubscriptionBefore = !!existingSub?.stripe_subscription_id

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: STRIPE_FOODTAXI_MONTHLY_PRICE_ID, quantity: 1 }],
      subscription_data: hasHadSubscriptionBefore ? undefined : { trial_period_days: FOODTAXI_TRIAL_DAYS },
      metadata: { business_id: business.id, kind: 'foodtaxi_business_subscription' },
      success_url: `${APP_URL}/dashboard/billing?subscribed=1`,
      cancel_url: `${APP_URL}/dashboard/billing?subscribed=0`,
    })

    // Ensure exactly one subscriptions row exists to attach the Stripe ids
    // to once the webhook confirms it. Explicit update-or-insert (rather
    // than upsert-on-conflict) so this doesn't depend on the business_id
    // unique constraint having been added (it's skipped by the migration
    // if duplicate rows already existed live).
    if (plan) {
      if (existingSub?.id) {
        // Starting real Checkout — even for a previously-grandfathered
        // business — means real Stripe status now governs access from here
        // on (the webhook sets the real status once Checkout completes).
        await admin.from('subscriptions').update({ plan_id: plan.id, stripe_customer_id: customerId, grandfathered: false }).eq('id', existingSub.id)
      } else {
        await admin.from('subscriptions').insert({ business_id: business.id, plan_id: plan.id, stripe_customer_id: customerId, grandfathered: false })
      }
    }

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Could not start checkout' }, { status: 500 })
  }
}
