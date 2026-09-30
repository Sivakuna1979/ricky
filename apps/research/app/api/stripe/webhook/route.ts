import type Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/auth/admin'
import { getStripe, recordFromSubscription } from '@/lib/billing/stripe'

export const runtime = 'nodejs'

/**
 * Stripe webhook — the only place a user's plan changes. Signature-verified
 * (STRIPE_WEBHOOK_SECRET); writes with the service role. Subscribe to:
 * checkout.session.completed, customer.subscription.created/updated/deleted.
 */
export async function POST(req: Request) {
  const stripe = getStripe()
  const db = supabaseAdmin()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !db || !secret) return Response.json({ error: 'Billing not configured' }, { status: 503 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(await req.text(), req.headers.get('stripe-signature') ?? '', secret)
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const save = async (sub: Stripe.Subscription, userIdHint?: string | null) => {
    const rec = recordFromSubscription(sub)
    const userId = userIdHint ?? sub.metadata?.user_id ?? null
    const q = db.from('users').update(rec)
    const { error } = userId ? await q.eq('id', userId) : await q.eq('stripe_customer_id', rec.stripe_customer_id)
    if (error) throw new Error(error.message)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object
        if (s.mode === 'subscription' && s.subscription) {
          const sub = await stripe.subscriptions.retrieve(typeof s.subscription === 'string' ? s.subscription : s.subscription.id)
          await save(sub, s.client_reference_id)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await save(event.data.object)
        break
    }
  } catch (e) {
    // Non-2xx makes Stripe retry.
    return Response.json({ error: e instanceof Error ? e.message : 'Webhook handling failed' }, { status: 500 })
  }
  return Response.json({ received: true })
}
