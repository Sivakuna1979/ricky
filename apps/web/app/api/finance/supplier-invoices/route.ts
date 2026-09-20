// @ts-nocheck
// H12–H15 — supplier invoices.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { round2 } from '@/lib/finance/money'
import { flagForReview } from '@/lib/finance/review'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_expenses')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const admin = await createAdminClient()
  let query = admin.from('supplier_invoices').select('*, supplier_records(supplier_name)').eq('business_id', ctx.businessId).order('invoice_date', { ascending: false }).limit(200)
  if (searchParams.get('status')) query = query.eq('status', searchParams.get('status'))
  const { data: invoices, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (invoices ?? []).map((i: any) => i.id)
  const { data: payments } = ids.length ? await admin.from('supplier_invoice_payments').select('supplier_invoice_id, amount').in('supplier_invoice_id', ids) : { data: [] }
  const paidByInvoice: Record<string, number> = {}
  for (const p of payments ?? []) paidByInvoice[p.supplier_invoice_id] = round2((paidByInvoice[p.supplier_invoice_id] ?? 0) + p.amount)

  const result = (invoices ?? []).map((i: any) => ({ ...i, amount_paid: paidByInvoice[i.id] ?? 0, outstanding_balance: round2(i.gross_amount - (paidByInvoice[i.id] ?? 0)) }))
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_supplier_invoices')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const { supplier_id, purchase_order_id, document_id, invoice_number, invoice_date, due_date, net_amount, vat_amount } = body
  if (!supplier_id || !invoice_date || net_amount == null) return NextResponse.json({ error: 'supplier_id, invoice_date and net_amount are required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: supplier } = await admin.from('supplier_records').select('id').eq('id', supplier_id).eq('business_id', ctx.businessId).maybeSingle()
  if (!supplier) return NextResponse.json({ error: 'Supplier not found for this business' }, { status: 404 })
  if (purchase_order_id) {
    const { data: po } = await admin.from('purchase_orders').select('id').eq('id', purchase_order_id).eq('business_id', ctx.businessId).maybeSingle()
    if (!po) return NextResponse.json({ error: 'Purchase order not found for this business' }, { status: 404 })
  }

  const net = round2(Number(net_amount))
  const vat = round2(Number(vat_amount ?? 0))
  const gross = round2(net + vat)

  const { data: invoice, error } = await admin.from('supplier_invoices').insert({
    business_id: ctx.businessId, supplier_id, purchase_order_id: purchase_order_id ?? null, document_id: document_id ?? null,
    invoice_number: invoice_number?.trim() || null, invoice_date, due_date: due_date ?? null,
    net_amount: net, vat_amount: vat, gross_amount: gross, status: 'UNPAID', created_by: ctx.userId,
  }).select().single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'An invoice with this number already exists for this supplier.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (document_id) await admin.from('finance_documents').update({ extraction_status: 'CONFIRMED', linked_supplier_invoice_id: invoice.id }).eq('id', document_id)
  if (!vat_amount && vat_amount !== 0) await flagForReview(admin, ctx.businessId, 'unknown_vat', 'supplier_invoices', invoice.id, { invoice_number })

  await logAuditEvent(admin, { actorId: ctx.userId, action: 'finance.supplier_invoice_created', entityType: 'supplier_invoices', entityId: invoice.id, newValues: invoice })
  return NextResponse.json(invoice, { status: 201 })
}
