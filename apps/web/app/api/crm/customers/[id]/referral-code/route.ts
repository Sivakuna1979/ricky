// @ts-nocheck
// I24 — generates (or returns the existing) referral code for a
// customer, for staff to hand out/print/share on the business's behalf.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { getOrCreateReferralCode } from '@/lib/crm/referrals'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_customers')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: customer } = await admin.from('crm_customers').select('id').eq('id', params.id).eq('business_id', ctx.businessId).maybeSingle()
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const code = await getOrCreateReferralCode(admin, ctx.businessId, params.id)
  return NextResponse.json(code)
}
