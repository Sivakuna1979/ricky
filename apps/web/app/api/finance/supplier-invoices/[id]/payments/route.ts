// @ts-nocheck
// H12/H13 — record a supplier payment (partial or full), with full
// auditability. Overpayment is prevented (H13) by checking the
// outstanding balance before insert; status (UNPAID/PARTIALLY_PAID/PAID)
// is derived from the actual payment total immediately after, never set
// independently.
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
  const { data: invoice } = await admin.from('supplier_invoices').select('*').eq('id', params.id).maybeSingle()
  if (!invoice || invoice.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (invoice.status === 'VOID') return NextResponse.json({ error: 'This invoice is void.' }, { status: 409 })

  const body = await req.json()
  const amount = round2(Number(body.amount))
  if (!amount || amount <= 0) return NextResponse.json({ error: 'A positive amount is required' }, { status: 400 })
  const paidAt = body.paid_at ?? new Date().toISOString().slice(0, 10)

  const { data: existingPayments } = await admin.from('supplier_invoice_payments').select('amount').eq('supplier_invoice_id', params.id)
  const alreadyPaid = round2((existingPayments ?? []).reduce((s: number, p: any) => s + p.amount, 0))
  const outstanding = round2(invoice.gross_amount - alreadyPaid)
  if (amount > outstanding + 0.01) {
    return NextResponse.json({ error: `This would overpay the invoice — only £${outstanding.toFixed(2)} is outstanding.` }, { status: 400 })
  }

  const { data: payment, error } = await admin.from('supplier_invoice_payments').insert({
    supplier_invoice_id: params.id, amount, paid_at: paidAt, payment_method: body.payment_method ?? 'bank_transfer', reference: body.reference ?? null, recorded_by: ctx.userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const newTotal = round2(alreadyPaid + amount)
  const newStatus = newTotal >= invoice.gross_amount - 0.01 ? 'PAID' : 'PARTIALLY_PAID'
  await admin.from('supplier_invoices').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', params.id)

  await logAuditEvent(admin, { actorId: ctx.userId, action: 'finance.supplier_payment_recorded', entityType: 'supplier_invoices', entityId: params.id, newValues: { payment, new_status: newStatus } })
  return NextResponse.json({ payment, status: newStatus, outstanding_balance: round2(invoice.gross_amount - newTotal) }, { status: 201 })
}
