// @ts-nocheck
// I5/I6 — customer profile + timeline. I6: order / reward earned /
// reward redeemed / voucher issued / campaign sent / feedback submitted
// / referral reward — never every trivial page view.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { getCustomerProfile } from '@/lib/crm/profile'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_customers')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: customer } = await admin.from('crm_customers').select('*').eq('id', params.id).eq('business_id', ctx.businessId).maybeSingle()
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const includeContact = hasPermission(ctx.role, 'view_customer_contact')

  const profile = await getCustomerProfile(admin, ctx.businessId, customer)
  const { data: loyaltyAccount } = await admin.from('loyalty_accounts').select('*').eq('crm_customer_id', customer.id).maybeSingle()

  const timeline: { type: string; at: string; detail: any }[] = []
  const { data: ledgerRows } = loyaltyAccount ? await admin.from('loyalty_ledger').select('*').eq('loyalty_account_id', loyaltyAccount.id).order('created_at', { ascending: false }).limit(30) : { data: [] }
  for (const l of ledgerRows ?? []) timeline.push({ type: l.type === 'EARN' ? 'reward_earned' : l.type === 'REDEEM' ? 'reward_redeemed' : 'loyalty_adjustment', at: l.created_at, detail: { points: l.points_delta, reason: l.reason } })

  const { data: vouchers } = await admin.from('vouchers').select('*').eq('intended_customer_id', customer.id).order('issued_at', { ascending: false }).limit(20)
  for (const v of vouchers ?? []) timeline.push({ type: 'voucher_issued', at: v.issued_at, detail: { code: v.code, status: v.status, source: v.source } })

  const reviewClauses: string[] = []
  if (customer.customer_id) reviewClauses.push(`customer_id.eq.${customer.customer_id}`)
  if (customer.normalized_phone) reviewClauses.push(`guest_phone.eq.${customer.normalized_phone}`)
  if (customer.email) reviewClauses.push(`guest_email.eq.${customer.email}`)
  const { data: reviews } = reviewClauses.length
    ? await admin.from('reviews').select('rating, comment, created_at').eq('business_id', ctx.businessId).or(reviewClauses.join(',')).limit(10)
    : { data: [] }
  for (const r of reviews ?? []) timeline.push({ type: 'feedback_submitted', at: r.created_at, detail: { rating: r.rating } })

  const { data: campaignSends } = await admin.from('campaign_recipients').select('sent_at, status, campaigns(name, channel)').eq('crm_customer_id', customer.id).eq('status', 'SENT').order('sent_at', { ascending: false }).limit(20)
  for (const c of campaignSends ?? []) timeline.push({ type: 'campaign_sent', at: c.sent_at, detail: { name: c.campaigns?.name, channel: c.campaigns?.channel } })

  timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  return NextResponse.json({
    id: customer.id, display_name: customer.display_name,
    phone: includeContact ? customer.normalized_phone : null, email: includeContact ? customer.email : null,
    tags: customer.tags, notes: hasPermission(ctx.role, 'manage_customer_notes') ? customer.notes : null,
    loyalty_enrolled: customer.loyalty_enrolled, loyalty_balance: loyaltyAccount?.balance ?? 0,
    marketing_preferences: { email: customer.marketing_email_opt_in, whatsapp: customer.marketing_whatsapp_opt_in, sms: customer.marketing_sms_opt_in },
    profile,
    timeline: timeline.slice(0, 30),
  })
}

// Body: { notes?, tags?, marketing_email_opt_in?, marketing_whatsapp_opt_in?, marketing_sms_opt_in? }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_customer_notes')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: existing } = await admin.from('crm_customers').select('*').eq('id', params.id).eq('business_id', ctx.businessId).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const updates: any = { updated_at: new Date().toISOString() }
  for (const field of ['notes', 'tags', 'marketing_email_opt_in', 'marketing_whatsapp_opt_in', 'marketing_sms_opt_in', 'loyalty_enrolled', 'birthday_month_day']) {
    if (body[field] !== undefined) updates[field] = body[field]
  }
  const { data: updated, error } = await admin.from('crm_customers').update(updates).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if ('notes' in body) await logAuditEvent(admin, { actorId: ctx.userId, action: 'crm.customer_note_changed', entityType: 'crm_customers', entityId: params.id, oldValues: { notes: existing.notes }, newValues: { notes: updated.notes } })
  if ('marketing_email_opt_in' in body || 'marketing_whatsapp_opt_in' in body || 'marketing_sms_opt_in' in body) {
    await logAuditEvent(admin, { actorId: ctx.userId, action: 'crm.marketing_preference_changed', entityType: 'crm_customers', entityId: params.id, oldValues: { email: existing.marketing_email_opt_in, whatsapp: existing.marketing_whatsapp_opt_in, sms: existing.marketing_sms_opt_in }, newValues: { email: updated.marketing_email_opt_in, whatsapp: updated.marketing_whatsapp_opt_in, sms: updated.marketing_sms_opt_in } })
  }
  return NextResponse.json(updated)
}
