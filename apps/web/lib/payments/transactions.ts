// @ts-nocheck
// L7/L8 — the ONE place a provider_transactions row is written from. Every
// caller (a webhook handler, a future POS terminal flow) goes through
// upsertProviderTransaction() rather than inserting directly, so the
// idempotency guarantee (UNIQUE(provider, provider_transaction_id) from the
// migration) is enforced exactly once, consistently, everywhere.
import { round2 } from '@/lib/finance/money'
import { PROVIDER_PAYMENT_STATUSES, PAYMENT_METHOD_TYPES } from './types'

export type UpsertTransactionParams = {
  businessId: string
  provider: string
  providerTransactionId: string
  status: string
  paymentMethodType: string
  amount: number
  currency?: string
  orderId?: string | null
  vanId?: string | null
  connectionId?: string | null
  terminalId?: string | null
  statusDetail?: Record<string, any> | null
}

// Returns the resulting row and whether this call actually changed
// anything (`changed: false` means a retry/replay arrived after the same
// state was already recorded — callers use this to avoid re-running
// downstream side effects like order progression a second time).
export async function upsertProviderTransaction(admin: any, params: UpsertTransactionParams) {
  if (!PROVIDER_PAYMENT_STATUSES.includes(params.status)) throw new Error(`unknown_payment_status:${params.status}`)
  if (!PAYMENT_METHOD_TYPES.includes(params.paymentMethodType)) throw new Error(`unknown_payment_method_type:${params.paymentMethodType}`)

  const { data: existing } = await admin
    .from('provider_transactions')
    .select('*')
    .eq('provider', params.provider)
    .eq('provider_transaction_id', params.providerTransactionId)
    .maybeSingle()

  const amount = round2(params.amount)

  if (!existing) {
    const { data: inserted, error } = await admin.from('provider_transactions').insert({
      business_id: params.businessId, van_id: params.vanId ?? null, order_id: params.orderId ?? null,
      connection_id: params.connectionId ?? null, terminal_id: params.terminalId ?? null,
      provider: params.provider, provider_transaction_id: params.providerTransactionId,
      status: params.status, payment_method_type: params.paymentMethodType, amount,
      currency: params.currency ?? 'GBP', status_detail: params.statusDetail ?? null,
    }).select().single()
    if (error) {
      // Lost a race with a concurrent webhook/replay for the exact same
      // transaction id — fall through and treat it as an update instead of
      // surfacing a spurious 500.
      if (error.code === '23505') return upsertProviderTransaction(admin, params)
      throw error
    }
    return { row: inserted, changed: true, created: true }
  }

  if (existing.status === params.status && existing.amount === amount) {
    return { row: existing, changed: false, created: false }
  }

  const { data: updated, error } = await admin
    .from('provider_transactions')
    .update({ status: params.status, amount, status_detail: params.statusDetail ?? existing.status_detail, order_id: params.orderId ?? existing.order_id, updated_at: new Date().toISOString() })
    .eq('id', existing.id)
    .select()
    .single()
  if (error) throw error
  return { row: updated, changed: true, created: false }
}

// L18 — draft a provider refund request. NEVER calls a provider API itself
// — this only ever creates/returns a PENDING row for a human (or, when
// drafted by the AI, a human confirming an ai_pending_actions proposal) to
// action. `idempotencyKey` should be caller-supplied and stable (e.g.
// `refund:${orderId}:${amountPence}:${requestedByUserId}`) so a
// double-click or a retried request can never create two refund attempts.
export async function draftProviderRefund(admin: any, params: {
  businessId: string
  providerTransactionRowId: string
  provider: string
  amount: number
  reason: string
  requestedBy: string
  idempotencyKey: string
}) {
  const { data: existing } = await admin.from('provider_refunds').select('*').eq('idempotency_key', params.idempotencyKey).maybeSingle()
  if (existing) return { row: existing, created: false }

  const { data: inserted, error } = await admin.from('provider_refunds').insert({
    business_id: params.businessId, provider_transaction_id: params.providerTransactionRowId,
    provider: params.provider, amount: round2(params.amount), reason: params.reason,
    requested_by: params.requestedBy, idempotency_key: params.idempotencyKey, status: 'PENDING',
  }).select().single()
  if (error) {
    if (error.code === '23505') return draftProviderRefund(admin, params)
    throw error
  }
  return { row: inserted, created: true }
}
