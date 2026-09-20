// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { round2 } from '@/lib/finance/money'
import { getPoInvoiceMatch } from '@/lib/finance/matching'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_expenses')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: invoice } = await admin.from('supplier_invoices').select('*, supplier_records(supplier_name)').eq('id', params.id).maybeSingle()
  if (!invoice || invoice.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: payments } = await admin.from('supplier_invoice_payments').select('*').eq('supplier_invoice_id', params.id).order('paid_at', { ascending: false })
  const amountPaid = round2((payments ?? []).reduce((s: number, p: any) => s + p.amount, 0))

  // H14 — three-way review, shown whenever a PO is linked.
  const match = invoice.purchase_order_id ? await getPoInvoiceMatch(admin, ctx.businessId, invoice.purchase_order_id) : null

  return NextResponse.json({ ...invoice, payments: payments ?? [], amount_paid: amountPaid, outstanding_balance: round2(invoice.gross_amount - amountPaid), po_match: match })
}

// Body: { status: 'REVIEW'|'VOID' } — only non-payment status transitions.
// PAID/PARTIALLY_PAID/UNPAID are derived automatically by the payments
// route below, never set directly, so they can never drift from the
// actual recorded payments.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_supplier_invoices')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: existing } = await admin.from('supplier_invoices').select('*').eq('id', params.id).maybeSingle()
  if (!existing || existing.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  if (!['REVIEW', 'VOID'].includes(body.status)) return NextResponse.json({ error: "status must be 'REVIEW' or 'VOID'" }, { status: 400 })

  const { data: updated } = await admin.from('supplier_invoices').update({ status: body.status, updated_at: new Date().toISOString() }).eq('id', params.id).select().single()
  await logAuditEvent(admin, { actorId: ctx.userId, action: 'finance.supplier_invoice_status_changed', entityType: 'supplier_invoices', entityId: params.id, oldValues: existing, newValues: updated })
  return NextResponse.json(updated)
}
