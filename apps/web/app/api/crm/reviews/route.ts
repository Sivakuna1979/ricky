// @ts-nocheck
// I46/I48 — business-side review management + factual satisfaction
// metrics.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { getReviewSummary } from '@/lib/crm/feedback'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_reviews')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const vanId = new URL(req.url).searchParams.get('van_id') ?? undefined
  const [summary, { data: reviews }] = await Promise.all([
    getReviewSummary(admin, ctx.businessId, vanId),
    (vanId ? admin.from('reviews').select('*').eq('business_id', ctx.businessId).eq('van_id', vanId) : admin.from('reviews').select('*').eq('business_id', ctx.businessId)).order('created_at', { ascending: false }).limit(200),
  ])
  return NextResponse.json({ summary, reviews: reviews ?? [] })
}
