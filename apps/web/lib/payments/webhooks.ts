// @ts-nocheck
// L9 — shared webhook idempotency, the exact pattern proven in production
// by app/api/webhooks/stripe/route.ts's stripe_webhook_events table:
// insert the event id FIRST; a unique-violation on redelivery means
// "already handled", short-circuit without reprocessing. Used by every
// Phase L webhook receiver (payment providers once approved, Xero,
// QuickBooks) so none of them has to reinvent this.
export async function claimWebhookEvent(admin: any, params: {
  providerKind: 'PAYMENT' | 'ACCOUNTING'
  provider: string
  eventId: string
  eventType: string
  businessId?: string | null
}) {
  const { data, error } = await admin.from('provider_webhook_events').insert({
    provider_kind: params.providerKind, provider: params.provider, event_id: params.eventId,
    event_type: params.eventType, business_id: params.businessId ?? null,
  }).select('id').single()
  if (error) {
    if (error.code === '23505') return { claimed: false, id: null }
    throw error
  }
  return { claimed: true, id: data.id }
}

export async function markWebhookEvent(admin: any, id: string, status: 'PROCESSED' | 'FAILED' | 'IGNORED', errorDetail?: string) {
  await admin.from('provider_webhook_events').update({
    status, error_detail: errorDetail ?? null, processed_at: new Date().toISOString(),
  }).eq('id', id)
}
