// @ts-nocheck
// L18 — step 2 of the human refund flow: the only place a person can
// directly trigger a real Stripe refund (the AI's equivalent path is
// app/api/ai/actions/[id]/confirm's 'confirm_provider_refund' branch —
// both call the same lib/payments/refundExecution.ts so they can never
// drift into inconsistent behaviour). Requires its own explicit POST,
// never triggered by step 1 (the request/draft).
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { executeProviderRefund, RefundExecutionError } from '@/lib/payments/refundExecution'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_payment_integrations')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  try {
    const result = await executeProviderRefund(admin, { refundId: params.id, businessId: ctx.businessId, userId: ctx.userId, auditAction: 'integrations.provider_refund_confirmed' })
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    if (e instanceof RefundExecutionError) return NextResponse.json({ error: e.message }, { status: e.statusCode })
    return NextResponse.json({ error: 'Could not complete the refund.' }, { status: 500 })
  }
}
