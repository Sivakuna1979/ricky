// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireCustomer } from '@/lib/customer/identity'
import { getCustomerWallet } from '@/lib/customer/wallet'

// GET /api/customer/wallet — J43/J44/J45, loyalty + rewards + referrals,
// composed live from Phase I's own tables (see lib/customer/wallet.ts).
export async function GET() {
  const supabase = await createClient()
  const admin = await createAdminClient()
  const ctx = await requireCustomer(supabase, admin)
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  try {
    // Best-effort: pick up any crm_customers rows a purchase already
    // created under this email that aren't linked yet (same safe rule as
    // /api/customer/preferences).
    await admin.from('crm_customers').update({ customer_id: ctx.customer.id }).is('customer_id', null).ilike('email', ctx.email)
  } catch { /* best effort */ }

  const wallet = await getCustomerWallet(admin, ctx.customer.id)
  return NextResponse.json(wallet)
}
