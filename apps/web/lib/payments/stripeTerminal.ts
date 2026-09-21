// @ts-nocheck
// L-B — the approved provider. Every call that touches a business's own
// money is made with `{ stripeAccount: connectedAccountId }` — this is
// the ENTIRE mechanism that keeps one business's Stripe Terminal charges
// from ever touching another business's account or FoodTaxi's own
// platform account (L24, release blocker). There is no separate OAuth
// token to store for Stripe Connect the way Xero/QuickBooks need one —
// the platform's own STRIPE_SECRET_KEY acts on behalf of a connected
// account purely via its account id, so `payment_provider_secrets` is
// never populated for STRIPE_TERMINAL.
//
// No per-order FoodTaxi commission is applied (`application_fee_amount`
// is never set) — the phase's explicit instruction was not to introduce
// one without separate approval, and none was given. 100% of a Terminal
// charge, minus Stripe's own processing fee, goes to the business's own
// connected account.
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-06-20' })
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://food-taxi.vercel.app'

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

// L27/L29 — Stripe Connect Express onboarding. Express (Stripe-hosted
// onboarding UI, Stripe collects and verifies the business's own bank/
// identity details) rather than Standard (a full separate Stripe
// dashboard) — the appropriate default for small food-truck businesses
// who want to accept card payments without becoming their own Stripe
// power-user. Returns a one-time-use hosted onboarding URL.
export async function createExpressAccountAndOnboardingLink(params: { businessId: string; businessName: string; existingAccountId?: string | null }) {
  const accountId = params.existingAccountId ?? (await stripe.accounts.create({
    type: 'express',
    business_type: 'company',
    business_profile: { name: params.businessName, mcc: '5814' }, // 5814 = fast food restaurants
    metadata: { foodtaxi_business_id: params.businessId },
  })).id

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${APP_URL}/api/integrations/payments/stripe-terminal/onboard?refresh=1`,
    return_url: `${APP_URL}/api/integrations/payments/stripe-terminal/return`,
    type: 'account_onboarding',
  })
  return { accountId, url: link.url }
}

// Re-checks the connected account's actual state with Stripe directly —
// never inferred from anything the browser claims on return from the
// hosted onboarding flow.
export async function getAccountStatus(accountId: string) {
  const account = await stripe.accounts.retrieve(accountId)
  const chargesEnabled = Boolean(account.charges_enabled)
  const payoutsEnabled = Boolean(account.payouts_enabled)
  const requirementsDue = (account.requirements?.currently_due?.length ?? 0) > 0 || (account.requirements?.past_due?.length ?? 0) > 0
  let status: 'CONNECTED' | 'ACTION_REQUIRED' | 'ERROR' = 'ACTION_REQUIRED'
  if (chargesEnabled && payoutsEnabled && !requirementsDue) status = 'CONNECTED'
  if (account.requirements?.disabled_reason) status = 'ERROR'
  return { status, chargesEnabled, payoutsEnabled, requirementsDue, disabledReason: account.requirements?.disabled_reason ?? null }
}

export async function createConnectionToken(accountId: string) {
  const token = await stripe.terminal.connectionTokens.create({}, { stripeAccount: accountId })
  return token.secret
}

export async function createTerminalLocation(accountId: string, params: { displayName: string; line1: string; city: string; postalCode: string; country?: string }) {
  const location = await stripe.terminal.locations.create({
    display_name: params.displayName,
    address: { line1: params.line1, city: params.city, postal_code: params.postalCode, country: params.country ?? 'GB' },
  }, { stripeAccount: accountId })
  return location.id
}

// A physical reader is registered once, by its pairing code, against a
// location. A simulated reader (for testing without hardware — see the
// POS Terminal component) needs no server-side registration at all; the
// Terminal Web SDK discovers it directly.
export async function registerTerminalReader(accountId: string, params: { registrationCode: string; locationId: string; label: string }) {
  const reader = await stripe.terminal.readers.create({
    registration_code: params.registrationCode, location: params.locationId, label: params.label,
  }, { stripeAccount: accountId })
  return reader.id
}

// L15 — server-authoritative: the server, never the till's own client-side
// total, decides the amount actually charged. `orderId` is embedded in
// metadata so the Connect webhook can progress the right order the moment
// Stripe confirms payment, without trusting anything the browser reports
// back.
export async function createTerminalPaymentIntent(accountId: string, params: { amountPence: number; orderId: string; businessId: string; vanId: string }) {
  const intent = await stripe.paymentIntents.create({
    amount: params.amountPence,
    currency: 'gbp',
    payment_method_types: ['card_present'],
    capture_method: 'automatic',
    metadata: { order_id: params.orderId, business_id: params.businessId, van_id: params.vanId, source: 'foodtaxi_pos_terminal' },
  }, { stripeAccount: accountId })
  return intent
}

export async function retrievePaymentIntent(accountId: string, paymentIntentId: string) {
  return stripe.paymentIntents.retrieve(paymentIntentId, { stripeAccount: accountId })
}

export async function cancelPaymentIntent(accountId: string, paymentIntentId: string) {
  return stripe.paymentIntents.cancel(paymentIntentId, {}, { stripeAccount: accountId })
}

// L18 — the one place a real Stripe refund is ever issued. Called only
// from the confirm step of the two-step human refund flow (never directly
// from a draft), which has already re-validated the transaction, amount,
// and authorisation.
export async function createStripeRefund(accountId: string, params: { paymentIntentId: string; amountPence: number; reason: string }) {
  const refund = await stripe.refunds.create({
    payment_intent: params.paymentIntentId,
    amount: params.amountPence,
    metadata: { foodtaxi_reason: params.reason.slice(0, 490) },
  }, { stripeAccount: accountId })
  return refund
}

export function verifyConnectWebhookSignature(body: string, signature: string) {
  return stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_CONNECT_WEBHOOK_SECRET ?? '')
}

export const toPence = (amountGbp: number) => Math.round(amountGbp * 100)
export const fromPence = (amountPence: number) => Math.round(amountPence) / 100
