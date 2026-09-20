// @ts-nocheck
// I16/I17 — loyalty lookup for POS: find a customer by phone (typed in)
// or by their opaque loyalty QR identifier (crm_customers.id — a random
// UUID, never anything derived from their name/phone, so nothing
// sensitive is encoded in the QR itself). Returns balance, progress
// toward the configured reward, and whether a reward is currently
// available to redeem.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { getLoyaltySettings, getOrCreateLoyaltyAccount } from '@/lib/crm/loyalty'
import { findOrCreateCrmCustomer } from '@/lib/crm/identity'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_loyalty')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const settings = await getLoyaltySettings(admin, ctx.businessId)
  if (!settings.enabled) return NextResponse.json({ error: 'Loyalty is not enabled for this business' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const crmCustomerId = searchParams.get('crm_customer_id')
  const phone = searchParams.get('phone')

  let customer: any = null
  if (crmCustomerId) {
    const { data } = await admin.from('crm_customers').select('*').eq('id', crmCustomerId).eq('business_id', ctx.businessId).maybeSingle()
    customer = data
  } else if (phone) {
    customer = await findOrCreateCrmCustomer(admin, ctx.businessId, { phone })
  } else {
    return NextResponse.json({ error: 'crm_customer_id or phone is required' }, { status: 400 })
  }
  if (!customer) return NextResponse.json({ found: false })

  const account = await getOrCreateLoyaltyAccount(admin, ctx.businessId, customer.id)
  const { data: activeVouchers } = await admin.from('vouchers').select('*').eq('intended_customer_id', customer.id).eq('status', 'ACTIVE')

  return NextResponse.json({
    found: true, crm_customer_id: customer.id, display_name: customer.display_name,
    balance: account.balance, reward_threshold: settings.reward_threshold,
    progress_pct: settings.reward_threshold ? Math.min(100, Math.round((account.balance / settings.reward_threshold) * 100)) : 0,
    reward_available: account.balance >= settings.reward_threshold,
    reward_description: settings.reward_description,
    active_vouchers: (activeVouchers ?? []).map((v: any) => ({ id: v.id, code: v.code, discount_type: v.discount_type, discount_value: v.discount_value, expires_at: v.expires_at })),
  })
}
