// @ts-nocheck
// I54 — the CRM/Growth dashboard's card data.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { getRetentionSummary } from '@/lib/crm/retention'
import { getReviewSummary } from '@/lib/crm/feedback'
import { ensureCrmCustomersBackfilled } from '@/lib/crm/backfill'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_marketing_analytics')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  await ensureCrmCustomersBackfilled(admin, ctx.businessId)
  const { data: vans } = await admin.from('vans').select('id').eq('business_id', ctx.businessId)
  const vanIds = (vans ?? []).map((v: any) => v.id)

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)

  const [retention, reviewSummary, loyaltyMembers, rewardsRedeemed, activeCampaigns] = await Promise.all([
    getRetentionSummary(admin, ctx.businessId, vanIds, monthStart, today),
    getReviewSummary(admin, ctx.businessId),
    admin.from('crm_customers').select('id', { count: 'exact', head: true }).eq('business_id', ctx.businessId).eq('loyalty_enrolled', true),
    admin.from('loyalty_ledger').select('id', { count: 'exact', head: true }).eq('business_id', ctx.businessId).eq('type', 'REDEEM'),
    admin.from('campaigns').select('id, name, status, estimated_recipients').eq('business_id', ctx.businessId).order('created_at', { ascending: false }).limit(5),
  ])

  return NextResponse.json({
    active_customers: retention.returning_customers + retention.new_customers,
    new_this_month: retention.new_customers,
    returning_customers: retention.returning_customers,
    lapsed_customers: retention.lapsed_customers,
    repeat_purchase_rate_pct: retention.repeat_purchase_rate_pct,
    loyalty_members: loyaltyMembers.count ?? 0,
    rewards_redeemed: rewardsRedeemed.count ?? 0,
    reviews: { average_rating: reviewSummary.average_rating, count: reviewSummary.review_count },
    recent_campaigns: activeCampaigns.data ?? [],
  })
}
