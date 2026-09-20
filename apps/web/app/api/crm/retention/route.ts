// @ts-nocheck
// I49/I50 — retention analytics & cohorts. One dispatcher over ?type=,
// matching Phase G/H's own analytics route convention — dashboard and AI
// tool call the exact same lib/crm/retention.ts functions.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { getRetentionSummary, getReorderWithinDays, getCohorts } from '@/lib/crm/retention'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_marketing_analytics')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const admin = await createAdminClient()
  const { data: vans } = await admin.from('vans').select('id').eq('business_id', ctx.businessId)
  const vanIds = (vans ?? []).map((v: any) => v.id)
  const type = searchParams.get('type') ?? 'summary'

  if (type === 'summary') {
    const start = searchParams.get('start') ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
    const end = searchParams.get('end') ?? new Date().toISOString().slice(0, 10)
    return NextResponse.json(await getRetentionSummary(admin, ctx.businessId, vanIds, start, end))
  }
  if (type === 'reorder') {
    return NextResponse.json(await getReorderWithinDays(admin, ctx.businessId, vanIds, Number(searchParams.get('days') ?? 30)))
  }
  if (type === 'cohorts') {
    return NextResponse.json({ cohorts: await getCohorts(admin, ctx.businessId, vanIds, Number(searchParams.get('months') ?? 6)) })
  }
  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}
