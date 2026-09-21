// @ts-nocheck
// L45 — deterministic (never AI-guessed) matching for FoodTaxi payments
// against provider transactions/refunds. A `provider_transactions` row is
// only ever matched to an order via its own `order_id` column (set at
// transaction-creation time by the server-authoritative flow that
// initiated it, see lib/payments/terminal.ts) — never by fuzzy
// amount/time heuristics, which could silently pair the wrong order. A
// transaction with no order_id, or an amount/status mismatch against its
// order, is routed to reconciliation_review_items for a human to resolve
// (L45/L46) — this file never resolves anything automatically.
import { round2 } from '@/lib/finance/money'

const AMOUNT_MISMATCH_TOLERANCE = 0.01

async function upsertReviewItem(admin: any, businessId: string, category: string, reference: Record<string, any>, detail: string) {
  // Dedupe on (business, category, the same reference identity) so a
  // repeated sweep never creates duplicate OPEN review rows for the same
  // underlying issue.
  const { data: existing } = await admin
    .from('reconciliation_review_items')
    .select('id')
    .eq('business_id', businessId).eq('category', category).eq('status', 'OPEN')
    .contains('reference', reference)
    .maybeSingle()
  if (existing) return existing.id

  const { data: inserted } = await admin.from('reconciliation_review_items').insert({
    business_id: businessId, category, reference, detail, status: 'OPEN',
  }).select('id').single()
  return inserted?.id ?? null
}

// L46 — run over a date window (defaults to the last 30 days of
// provider_transactions), returns a summary AND writes any newly-detected
// issues into the review queue. Idempotent to re-run (upsertReviewItem
// dedupes) — safe to call from both a manual "re-check" button and a
// scheduled sweep.
export async function runReconciliationSweep(admin: any, businessId: string, opts: { sinceIso?: string } = {}) {
  const sinceIso = opts.sinceIso ?? new Date(Date.now() - 30 * 86400000).toISOString()

  const { data: transactions } = await admin
    .from('provider_transactions')
    .select('id, order_id, amount, status, provider, provider_transaction_id, created_at')
    .eq('business_id', businessId).gte('created_at', sinceIso)

  let unmatched = 0, amountMismatches = 0, missingConfirmation = 0
  const seenOrderIds = new Map<string, string[]>()

  for (const txn of transactions ?? []) {
    if (!txn.order_id) {
      unmatched++
      await upsertReviewItem(admin, businessId, 'UNMATCHED_PROVIDER_TXN', { provider_transaction_id: txn.id }, `${txn.provider} transaction ${txn.provider_transaction_id} has no linked FoodTaxi order.`)
      continue
    }

    const list = seenOrderIds.get(txn.order_id) ?? []
    list.push(txn.id)
    seenOrderIds.set(txn.order_id, list)

    const { data: order } = await admin.from('orders').select('id, total, payment_method').eq('id', txn.order_id).maybeSingle()
    if (!order) continue

    if (['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(txn.status) && Math.abs(round2(order.total) - round2(txn.amount)) > AMOUNT_MISMATCH_TOLERANCE) {
      amountMismatches++
      await upsertReviewItem(admin, businessId, 'AMOUNT_MISMATCH', { provider_transaction_id: txn.id, order_id: order.id }, `Order total £${order.total.toFixed(2)} does not match provider transaction amount £${txn.amount.toFixed(2)}.`)
    }
    if (['PENDING', 'AUTHORISED'].includes(txn.status)) {
      missingConfirmation++
      await upsertReviewItem(admin, businessId, 'MISSING_CONFIRMATION', { provider_transaction_id: txn.id, order_id: order.id }, `Provider transaction for order ${order.id} is still ${txn.status.toLowerCase()} — never confirmed SUCCEEDED.`)
    }
  }

  let duplicateCandidates = 0
  for (const [orderId, txnIds] of seenOrderIds) {
    if (txnIds.length > 1) {
      duplicateCandidates++
      await upsertReviewItem(admin, businessId, 'DUPLICATE_CANDIDATE', { order_id: orderId, provider_transaction_ids: txnIds.sort() }, `Order ${orderId} has ${txnIds.length} provider transactions linked to it.`)
    }
  }

  return {
    transactions_checked: (transactions ?? []).length,
    unmatched_provider_transactions: unmatched,
    amount_mismatches: amountMismatches,
    missing_confirmation: missingConfirmation,
    duplicate_candidates: duplicateCandidates,
  }
}

export async function getReviewQueue(admin: any, businessId: string, status: string = 'OPEN') {
  const { data } = await admin.from('reconciliation_review_items').select('*').eq('business_id', businessId).eq('status', status).order('created_at', { ascending: false }).limit(200)
  return data ?? []
}
