// @ts-nocheck
// H41–H45 — professional customer invoices (catering/events), entirely
// separate from the FoodTaxi £29.99 platform event-booking fee (never
// read or written by this route).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { round2, sum } from '@/lib/finance/money'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_sales_finance')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data, error } = await admin.from('customer_invoices').select('*').eq('business_id', ctx.businessId).order('invoice_date', { ascending: false }).limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Body: { customer_name, customer_email?, invoice_date, due_date?, invoice_prefix?,
//         event_application_id?, items: [{ description, quantity, unit_price, vat_rate? }] }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_supplier_invoices')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const { customer_name, customer_email, invoice_date, due_date, invoice_prefix, event_application_id, items } = body
  if (!customer_name || !invoice_date || !items?.length) return NextResponse.json({ error: 'customer_name, invoice_date and at least one item are required' }, { status: 400 })

  const admin = await createAdminClient()
  if (event_application_id) {
    const { data: ea } = await admin.from('event_applications').select('id').eq('id', event_application_id).maybeSingle()
    if (!ea) return NextResponse.json({ error: 'Event application not found' }, { status: 404 })
  }

  // Duplicate-safe numbering (H45) — next sequential number for this business.
  const { count } = await admin.from('customer_invoices').select('id', { count: 'exact', head: true }).eq('business_id', ctx.businessId)
  const nextNumber = String((count ?? 0) + 1).padStart(4, '0')
  const invoiceNumber = `${(invoice_prefix ?? '').trim()}${nextNumber}`

  const lineItems = items.map((i: any) => {
    const quantity = Number(i.quantity ?? 1)
    const unitPrice = round2(Number(i.unit_price))
    return { description: i.description, quantity, unit_price: unitPrice, vat_rate: i.vat_rate != null ? Number(i.vat_rate) : null, line_total: round2(quantity * unitPrice) }
  })
  const net = sum(lineItems.map((i: any) => i.line_total))
  const vat = sum(lineItems.map((i: any) => i.vat_rate != null ? round2(i.line_total * (i.vat_rate / 100)) : 0))
  const gross = round2(net + vat)

  const { data: invoice, error } = await admin.from('customer_invoices').insert({
    business_id: ctx.businessId, event_application_id: event_application_id ?? null,
    invoice_prefix: invoice_prefix ?? null, invoice_number: invoiceNumber,
    customer_name, customer_email: customer_email ?? null, invoice_date, due_date: due_date ?? null,
    net_amount: net, vat_amount: vat, gross_amount: gross, status: 'DRAFT', created_by: ctx.userId,
  }).select().single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'That invoice number already exists — try again.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await admin.from('customer_invoice_items').insert(lineItems.map((i: any) => ({ ...i, customer_invoice_id: invoice.id })))
  await logAuditEvent(admin, { actorId: ctx.userId, action: 'finance.customer_invoice_created', entityType: 'customer_invoices', entityId: invoice.id, newValues: invoice })
  return NextResponse.json({ ...invoice, items: lineItems }, { status: 201 })
}
