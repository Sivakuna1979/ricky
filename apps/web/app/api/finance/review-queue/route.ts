// @ts-nocheck
// H54 — finance review queue.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { getReviewQueue, resolveReviewItem } from '@/lib/finance/review'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_finance_summary')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const status = new URL(req.url).searchParams.get('status') ?? 'OPEN'
  return NextResponse.json(await getReviewQueue(admin, ctx.businessId, status))
}

// Body: { id, status: 'RESOLVED'|'DISMISSED' }
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'approve_expense')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  if (!body.id || !['RESOLVED', 'DISMISSED'].includes(body.status)) return NextResponse.json({ error: 'id and a valid status are required' }, { status: 400 })

  const admin = await createAdminClient()
  const updated = await resolveReviewItem(admin, ctx.businessId, body.id, ctx.userId, body.status)
  if (!updated) return NextResponse.json({ error: 'Not found or already resolved' }, { status: 404 })
  return NextResponse.json(updated)
}
