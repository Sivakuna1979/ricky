import Stripe from 'stripe'
import type { Plan } from '@/lib/plans'

/** Premium: 3 months free, then £9.99/month (price configured in Stripe as STRIPE_PRICE_PREMIUM). */
export const TRIAL_DAYS = 90

let client: Stripe | null = null
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  if (!client) client = new Stripe(key)
  return client
}

export function billingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_PREMIUM && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

/** Which subscription statuses grant Premium. past_due keeps access during Stripe's retry window. */
export function planForStatus(status: string | null | undefined): Plan {
  return status === 'trialing' || status === 'active' || status === 'past_due' ? 'premium' : 'free'
}

export interface SubscriptionRecord {
  stripe_customer_id: string
  stripe_subscription_id: string
  subscription_status: string
  plan: Plan
  trial_ends_at: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  has_used_trial: boolean
}

const iso = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null)

/** Pure mapping from a Stripe subscription to the columns stored on public.users. */
export function recordFromSubscription(sub: Pick<Stripe.Subscription, 'id' | 'status' | 'trial_end' | 'cancel_at_period_end' | 'customer' | 'items'>): SubscriptionRecord {
  const periodEnds = sub.items.data.map((i) => i.current_period_end).filter((x): x is number => typeof x === 'number')
  return {
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    plan: planForStatus(sub.status),
    trial_ends_at: iso(sub.trial_end),
    current_period_end: iso(periodEnds.length ? Math.max(...periodEnds) : null),
    cancel_at_period_end: sub.cancel_at_period_end,
    has_used_trial: true,
  }
}
