// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { round2 } from '@/lib/finance/money'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_sales_finance')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: invoice } = await admin.from('customer_invoices').select('*').eq('id', params.id).maybeSingle()
  if (!invoice || invoice.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [{ data: items }, { data: payments }] = await Promise.all([
    admin.from('customer_invoice_items').select('*').eq('customer_invoice_id', params.id),
    admin.from('customer_invoice_payments').select('*').eq('customer_invoice_id', params.id).order('paid_at', { ascending: false }),
  ])
  const amountPaid = round2((payments ?? []).reduce((s: number, p: any) => s + p.amount, 0))
  return NextResponse.json({ ...invoice, items: items ?? [], payments: payments ?? [], amount_paid: amountPaid, outstanding_balance: round2(invoice.gross_amount - amountPaid) })
}

// Body: { status: 'SENT'|'VOID' } — PAID is derived automatically by the payments route.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_supplier_invoices')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: existing } = await admin.from('customer_invoices').select('*').eq('id', params.id).maybeSingle()
  if (!existing || existing.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  if (!['SENT', 'VOID'].includes(body.status)) return NextResponse.json({ error: "status must be 'SENT' or 'VOID'" }, { status: 400 })

  const { data: updated } = await admin.from('customer_invoices').update({ status: body.status, updated_at: new Date().toISOString() }).eq('id', params.id).select().single()
  await logAuditEvent(admin, { actorId: ctx.userId, action: 'finance.customer_invoice_status_changed', entityType: 'customer_invoices', entityId: params.id, oldValues: existing, newValues: updated })
  return NextResponse.json(updated)
}
