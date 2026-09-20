// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { round2 } from '@/lib/finance/money'
import { logAuditEvent } from '@/lib/auditLog'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'record_supplier_payment')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: invoice } = await admin.from('customer_invoices').select('*').eq('id', params.id).maybeSingle()
  if (!invoice || invoice.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (invoice.status === 'VOID') return NextResponse.json({ error: 'This invoice is void.' }, { status: 409 })

  const body = await req.json()
  const amount = round2(Number(body.amount))
  if (!amount || amount <= 0) return NextResponse.json({ error: 'A positive amount is required' }, { status: 400 })

  const { data: existingPayments } = await admin.from('customer_invoice_payments').select('amount').eq('customer_invoice_id', params.id)
  const alreadyPaid = round2((existingPayments ?? []).reduce((s: number, p: any) => s + p.amount, 0))
  const outstanding = round2(invoice.gross_amount - alreadyPaid)
  if (amount > outstanding + 0.01) return NextResponse.json({ error: `This would overpay the invoice — only £${outstanding.toFixed(2)} is outstanding.` }, { status: 400 })

  const { data: payment, error } = await admin.from('customer_invoice_payments').insert({
    customer_invoice_id: params.id, amount, paid_at: body.paid_at ?? new Date().toISOString().slice(0, 10),
    method: body.method ?? 'bank_transfer', reference: body.reference ?? null, recorded_by: ctx.userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const newTotal = round2(alreadyPaid + amount)
  if (newTotal >= invoice.gross_amount - 0.01) await admin.from('customer_invoices').update({ status: 'PAID', updated_at: new Date().toISOString() }).eq('id', params.id)

  await logAuditEvent(admin, { actorId: ctx.userId, action: 'finance.customer_invoice_payment_recorded', entityType: 'customer_invoices', entityId: params.id, newValues: payment })
  return NextResponse.json({ payment, outstanding_balance: round2(invoice.gross_amount - newTotal) }, { status: 201 })
}
