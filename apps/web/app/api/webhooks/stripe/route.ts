// @ts-nocheck
// ============================================================================
// Signature-verified Stripe webhook. Handler-by-handler status:
//   ✅ checkout.session.completed (kind === 'event_booking_fee') — ACTIVE,
//      confirms the £29.99 event booking fee from /api/events/pay.
//   ✅ checkout.session.completed (kind === 'foodtaxi_business_subscription'),
//      customer.subscription.created/updated/deleted, invoice.payment_failed
//      — ACTIVE as of Phase B. This is the FoodTaxi Business £19.99/month
//      subscription (app/api/subscriptions/checkout & portal). Stripe is
//      authoritative for subscription status; this handler only mirrors it
//      into subscriptions.status — see lib/subscriptionAccess.ts.
//   ⚠️ payment_intent.succeeded / payment_intent.payment_failed — dead in
//      practice: only ever created by the inactive /api/payments/create-intent
//      (Stripe Connect experiment). Harmless to leave; nothing calls
//      create-intent today so these never fire.
//
// Idempotent: every event.id is recorded in stripe_webhook_events before
// processing. Stripe redelivers events; a redelivered id is skipped so
// subscriptions/orders are never updated twice for the same event.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-06-20' })

const SUBSCRIPTION_STATUS_MAP: Record<string, string> = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  canceled: 'cancelled',
  unpaid: 'unpaid',
  incomplete: 'past_due',
  incomplete_expired: 'cancelled',
  paused: 'past_due',
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET ?? '')
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // Idempotency guard (Phase B8) — record this event id once; a redelivery
  // hits the primary key and is skipped without reprocessing.
  const { error: dupErr } = await supabase.from('stripe_webhook_events').insert({ id: event.id, type: event.type })
  if (dupErr) {
    if (dupErr.code === '23505') return NextResponse.json({ received: true, duplicate: true })
    // Unknown DB error — do NOT report success, so Stripe retries delivery
    // instead of us silently dropping an unprocessed event.
    return NextResponse.json({ error: 'Could not record webhook event' }, { status: 500 })
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object as Stripe.PaymentIntent
      const { order_id } = intent.metadata

      await supabase
        .from('payments')
        .update({ status: 'succeeded', paid_at: new Date().toISOString() })
        .eq('stripe_payment_intent_id', intent.id)

      // Confirm order is pending (payment received)
      await supabase
        .from('orders')
        .update({ status: 'pending' })
        .eq('id', order_id)
        .eq('status', 'pending')

      break
    }

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session

      if (session.metadata?.kind === 'event_booking_fee' && session.metadata?.application_id) {
        // Booking fee paid — confirm the van's place and the event.
        await supabase
          .from('event_applications')
          .update({ status: 'confirmed', paid_at: new Date().toISOString() })
          .eq('id', session.metadata.application_id)
        await supabase
          .from('event_requests')
          .update({ admin_status: 'confirmed' })
          .eq('id', session.metadata.event_id)
      }

      if (session.metadata?.kind === 'foodtaxi_business_subscription' && session.metadata?.business_id) {
        // Link the Stripe subscription id now; status/trial/period dates are
        // synced by the customer.subscription.* handlers below, which fire
        // for the same checkout and are the authoritative source for those.
        await supabase
          .from('subscriptions')
          .update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
          })
          .eq('business_id', session.metadata.business_id)
      }
      break
    }

    case 'payment_intent.payment_failed': {
      const intent = event.data.object as Stripe.PaymentIntent
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('stripe_payment_intent_id', intent.id)
      break
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const mappedStatus = SUBSCRIPTION_STATUS_MAP[sub.status as string] ?? 'past_due'

      // Match by Stripe customer id — reliably set on the subscriptions row
      // by /api/subscriptions/checkout before Checkout is ever opened, so
      // this works regardless of Stripe's event delivery order (unlike
      // matching on stripe_subscription_id, which isn't known yet on the
      // very first 'created' event).
      await supabase
        .from('subscriptions')
        .update({
          stripe_subscription_id: sub.id,
          status: mappedStatus,
          trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
          current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          cancelled_at: event.type === 'customer.subscription.deleted' ? new Date().toISOString() : null,
        })
        .eq('stripe_customer_id', sub.customer as string)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      if (invoice.customer) {
        await supabase.from('subscriptions').update({ status: 'past_due' }).eq('stripe_customer_id', invoice.customer as string)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
