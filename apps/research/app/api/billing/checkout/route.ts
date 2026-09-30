import { NextResponse } from 'next/server'
import { getViewer } from '@/lib/auth/viewer'
import { supabaseAdmin } from '@/lib/auth/admin'
import { billingConfigured, getStripe, TRIAL_DAYS } from '@/lib/billing/stripe'
import { clientKey, rateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'

/** Starts Stripe Checkout for Premium: 3-month free trial (first time only), then £9.99/month. */
export async function POST(req: Request) {
  const origin = new URL(req.url).origin
  if (!rateLimit(`checkout:${clientKey(req)}`, 10, 60_000).ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const stripe = getStripe()
  const db = supabaseAdmin()
  if (!billingConfigured() || !stripe || !db) return NextResponse.redirect(`${origin}/pricing?billing=unavailable`, 303)
  const viewer = await getViewer()
  if (!viewer.user) return NextResponse.redirect(`${origin}/sign-in?next=/pricing`, 303)

  const { data: row } = await db.from('users').select('stripe_customer_id,has_used_trial,subscription_status').eq('id', viewer.user.id).maybeSingle()
  if (row?.subscription_status === 'active' || row?.subscription_status === 'trialing') return NextResponse.redirect(`${origin}/account`, 303)

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_PREMIUM!, quantity: 1 }],
    client_reference_id: viewer.user.id,
    ...(row?.stripe_customer_id ? { customer: row.stripe_customer_id } : { customer_email: viewer.user.email ?? undefined }),
    subscription_data: {
      metadata: { user_id: viewer.user.id },
      // One free trial per account.
      ...(row?.has_used_trial ? {} : { trial_period_days: TRIAL_DAYS, trial_settings: { end_behavior: { missing_payment_method: 'cancel' } } }),
    },
    allow_promotion_codes: true,
    success_url: `${origin}/account?checkout=success`,
    cancel_url: `${origin}/pricing?checkout=cancelled`,
  })
  return NextResponse.redirect(session.url!, 303)
}
