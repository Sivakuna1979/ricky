// @ts-nocheck
// H22/H23 — refunds. A factual record only — never issues a real
// provider refund (no approved payment-provider integration exists to
// call). Recording a refund here is what makes it get subtracted from
// net revenue everywhere (lib/finance/revenue.ts).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { assertVanAllowed } from '@/lib/ai/context'
import { round2 } from '@/lib/finance/money'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_sales_finance')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data, error } = await admin.from('refunds').select('*, orders(order_number, van_id)').eq('business_id', ctx.businessId).order('refunded_at', { ascending: false }).limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Body: { order_id, amount, reason, method }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'approve_expense')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const { order_id, amount, reason, method } = body
  if (!order_id || !amount || !reason) return NextResponse.json({ error: 'order_id, amount and reason are required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: order } = await admin.from('orders').select('id, van_id, total, vans(business_id)').eq('id', order_id).maybeSingle()
  if (!order || order.vans?.business_id !== ctx.businessId) return NextResponse.json({ error: 'Order not found for this business' }, { status: 404 })
  try { assertVanAllowed(ctx, order.van_id) } catch { return NextResponse.json({ error: 'Not authorized for that van' }, { status: 403 }) }

  const { data: existingRefunds } = await admin.from('refunds').select('amount').eq('order_id', order_id)
  const alreadyRefunded = round2((existingRefunds ?? []).reduce((s: number, r: any) => s + r.amount, 0))
  const refundAmount = round2(Number(amount))
  if (refundAmount <= 0 || alreadyRefunded + refundAmount > order.total + 0.01) {
    return NextResponse.json({ error: `This would refund more than the order total (£${order.total.toFixed(2)}, £${alreadyRefunded.toFixed(2)} already refunded).` }, { status: 400 })
  }

  const { data: refund, error } = await admin.from('refunds').insert({
    business_id: ctx.businessId, order_id, amount: refundAmount, reason, method: method ?? 'cash', recorded_by: ctx.userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent(admin, { actorId: ctx.userId, action: 'finance.refund_recorded', entityType: 'refunds', entityId: refund.id, newValues: refund })
  return NextResponse.json(refund, { status: 201 })
}
