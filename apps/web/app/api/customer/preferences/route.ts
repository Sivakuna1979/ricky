// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireCustomer } from '@/lib/customer/identity'

// J70 — "Phase I remains authoritative for customer/CRM/consent... do not
// create another customer preference system." This route does NOT
// introduce a new preference store: it reads/writes the exact same
// per-business crm_customers.marketing_*_opt_in columns Phase I already
// defined and that business-side campaigns already respect. It only adds
// a customer-facing surface on top of them, one row per business the
// customer has ordered from.
//
// Linking: crm_customers.customer_id is set (a) automatically going
// forward, the first time an order this customer placed is collected
// (lib/crm/identity.ts, unchanged), and (b) retroactively here, by exact
// verified-email match — the same safe rule used for order claiming, never
// inferred from name/phone.
async function linkCrmRowsByEmail(admin, customerId, email) {
  if (!email) return
  await admin.from('crm_customers').update({ customer_id: customerId }).is('customer_id', null).ilike('email', email)
}

export async function GET() {
  const supabase = await createClient()
  const admin = await createAdminClient()
  const ctx = await requireCustomer(supabase, admin)
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  try { await linkCrmRowsByEmail(admin, ctx.customer.id, ctx.email) } catch { /* best effort */ }

  const { data, error } = await admin
    .from('crm_customers')
    .select('id, business_id, marketing_email_opt_in, marketing_sms_opt_in, marketing_whatsapp_opt_in, loyalty_enrolled, businesses(name)')
    .eq('customer_id', ctx.customer.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ preferences: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const admin = await createAdminClient()
  const ctx = await requireCustomer(supabase, admin)
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { crm_customer_id, marketing_email_opt_in, marketing_sms_opt_in, marketing_whatsapp_opt_in } = body
  if (!crm_customer_id) return NextResponse.json({ error: 'crm_customer_id required' }, { status: 400 })

  // Ownership check — a customer may only edit a crm_customers row that is
  // actually linked to their own account (J57).
  const { data: row } = await admin.from('crm_customers').select('id, customer_id').eq('id', crm_customer_id).maybeSingle()
  if (!row || row.customer_id !== ctx.customer.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: any = { updated_at: new Date().toISOString() }
  if (typeof marketing_email_opt_in === 'boolean') updates.marketing_email_opt_in = marketing_email_opt_in
  if (typeof marketing_sms_opt_in === 'boolean') updates.marketing_sms_opt_in = marketing_sms_opt_in
  if (typeof marketing_whatsapp_opt_in === 'boolean') updates.marketing_whatsapp_opt_in = marketing_whatsapp_opt_in

  const { error } = await admin.from('crm_customers').update(updates).eq('id', crm_customer_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
