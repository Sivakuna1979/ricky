// @ts-nocheck
// L18/L58 — step 1 of the human refund flow: draft only, exactly the same
// safety shape as the AI's propose_provider_refund tool (this route and
// that tool both ultimately create a PENDING provider_refunds row; NEITHER
// ever calls Stripe directly — only the separate /confirm step,
// step 2, does that, and only after a second explicit authenticated action).
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { round2 } from '@/lib/finance/money'
import { draftProviderRefund } from '@/lib/payments/transactions'

// Body: { amount, reason }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_payment_integrations')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { amount, reason } = await req.json().catch(() => ({}))
  if (!amount || !reason) return NextResponse.json({ error: 'amount and reason are required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: txn } = await admin.from('provider_transactions').select('*').eq('id', params.id).eq('business_id', ctx.businessId).maybeSingle()
  if (!txn) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!['SUCCEEDED', 'PARTIALLY_REFUNDED'].includes(txn.status)) return NextResponse.json({ error: `This transaction is ${txn.status.toLowerCase()} and cannot be refunded.` }, { status: 409 })

  const { data: priorRefunds } = await admin.from('provider_refunds').select('amount').eq('provider_transaction_id', txn.id).eq('status', 'SUCCEEDED')
  const alreadyRefunded = round2((priorRefunds ?? []).reduce((s: number, r: any) => s + r.amount, 0))
  const refundAmount = round2(Number(amount))
  if (refundAmount <= 0 || alreadyRefunded + refundAmount > txn.amount + 0.01) {
    return NextResponse.json({ error: `This would refund more than the transaction total (£${txn.amount.toFixed(2)}, £${alreadyRefunded.toFixed(2)} already refunded).` }, { status: 400 })
  }

  // A double-click reuses the exact same idempotency key (same txn, same
  // amount, same requester) — draftProviderRefund returns the existing
  // PENDING row instead of creating a second one.
  const idempotencyKey = `manual_refund:${txn.id}:${Math.round(refundAmount * 100)}:${ctx.userId}`
  const { row: refund, created } = await draftProviderRefund(admin, {
    businessId: ctx.businessId, providerTransactionRowId: txn.id, provider: txn.provider,
    amount: refundAmount, reason, requestedBy: ctx.userId, idempotencyKey,
  })

  return NextResponse.json({ refund_id: refund.id, amount: refund.amount, created, note: 'This is a request only. No money has moved yet — confirm it to actually issue the refund.' }, { status: 201 })
}
