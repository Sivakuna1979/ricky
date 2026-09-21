// @ts-nocheck
// L4 — the provider-neutral vocabulary every payments file in this phase
// shares. Nothing here is provider-specific; a provider adapter (once one
// is approved and built in Phase L-B) maps ITS OWN status vocabulary onto
// this one, never the other way round.

export const PAYMENT_PROVIDERS = ['STRIPE_TERMINAL', 'SUMUP', 'SQUARE', 'ZETTLE', 'DOJO', 'OTHER'] as const
export type PaymentProvider = typeof PAYMENT_PROVIDERS[number]

// L7 — the full provider-mapped payment lifecycle. A provider adapter
// resolves its own webhook/API status strings onto exactly these values —
// nothing downstream (reconciliation, receipts, Finance Hub) ever sees a
// provider's native status string.
export const PROVIDER_PAYMENT_STATUSES = [
  'CREATED', 'PENDING', 'AUTHORISED', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED',
] as const
export type ProviderPaymentStatus = typeof PROVIDER_PAYMENT_STATUSES[number]

// L8 — distinguishes HOW a payment was actually verified, not just what
// button staff tapped. CASH/CARD_RECORDED already exist today as staff
// labels (payment_method 'cash_at_van'/'card_at_van' on `orders` — left
// untouched). PROVIDER_VERIFIED_CARD is the ONLY value that means "a real
// payment provider actually confirmed this transaction" — it must never be
// set anywhere except by genuine provider confirmation (a webhook or a
// verified API response), never by a staff button tap. ONLINE_PROVIDER is
// its online-checkout equivalent (order.payment_method 'card_online').
export const PAYMENT_METHOD_TYPES = ['CASH', 'CARD_RECORDED', 'PROVIDER_VERIFIED_CARD', 'ONLINE_PROVIDER', 'OTHER'] as const
export type PaymentMethodType = typeof PAYMENT_METHOD_TYPES[number]

export const CONNECTION_STATUSES = ['DISCONNECTED', 'CONNECTED', 'ACTION_REQUIRED', 'ERROR'] as const
export type ConnectionStatus = typeof CONNECTION_STATUSES[number]

export const TERMINAL_STATUSES = ['ACTIVE', 'OFFLINE', 'UNASSIGNED', 'ERROR'] as const

// L6 — capability facts gathered directly from each provider's own
// developer documentation (via WebSearch, since direct WebFetch to
// docs.stripe.com/developer.sumup.com was blocked by this environment's
// egress proxy) for the Phase L provider decision report. This is
// reference data only — used by the Integration Centre to explain to the
// user what each (currently unconnected) provider offers, never to
// silently pick one. Fee figures are explicitly NOT included here — UK
// card fees are bespoke per merchant and were only ever sourced from
// third-party comparison sites in research, never a provider's own
// pricing page, so they are not asserted as fact anywhere in the app.
export const PAYMENT_PROVIDER_INFO: Record<PaymentProvider, {
  label: string
  ukAvailable: boolean
  confirmedPaymentCreationApi: boolean
  inPersonModel: 'sdk_reader' | 'remote_trigger_terminal' | 'unknown'
  notes: string
}> = {
  STRIPE_TERMINAL: {
    label: 'Stripe Terminal',
    ukAvailable: true,
    confirmedPaymentCreationApi: true,
    inPersonModel: 'sdk_reader',
    notes: 'FoodTaxi already has a live Stripe account, webhook pipeline and SDK dependency for the platform subscription and event-booking fee — lowest integration risk of the candidates researched. UK-certified readers confirmed (BBPOS WisePad 3, Stripe Reader S700/S710).',
  },
  SUMUP: {
    label: 'SumUp',
    ukAvailable: true,
    confirmedPaymentCreationApi: true,
    inPersonModel: 'remote_trigger_terminal',
    notes: 'Cloud API remotely triggers a checkout on a merchant’s existing terminal. Confirmed refund endpoint (POST /v0.1/me/refund/{txn_id}, partial refunds supported) and webhook events (incl. REFUND_STATUS_CHANGED) with signature verification.',
  },
  SQUARE: {
    label: 'Square',
    ukAvailable: true,
    confirmedPaymentCreationApi: true,
    inPersonModel: 'remote_trigger_terminal',
    notes: 'UK availability is Terminal API only — Square’s in-app Reader SDK is NOT available in the UK, so a Bluetooth-dongle-in-phone experience is not possible here.',
  },
  ZETTLE: {
    label: 'Zettle by PayPal',
    ukAvailable: true,
    confirmedPaymentCreationApi: false,
    inPersonModel: 'unknown',
    notes: 'Public developer API confirmed to cover Finance/Payout, Purchases (read/history), Inventory and real-time Pusher events — no publicly documented endpoint for CREATING a new payment was found. Weakest-verified candidate for FoodTaxi’s actual need.',
  },
  DOJO: {
    label: 'Dojo',
    ukAvailable: true,
    confirmedPaymentCreationApi: true,
    inPersonModel: 'unknown',
    notes: 'Confirmed self-serve Developer Portal (docs.dojo.tech) with API-key auth, a documented Payment Service and in-person/online payment guides — added as the phase’s "or another suitable provider" option. Refund/webhook specifics not yet explored to the same depth as the other candidates.',
  },
  OTHER: {
    label: 'Other',
    ukAvailable: false,
    confirmedPaymentCreationApi: false,
    inPersonModel: 'unknown',
    notes: 'Placeholder for a provider not yet researched.',
  },
}
