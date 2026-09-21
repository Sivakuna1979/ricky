// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { getReviewQueue } from '@/lib/payments/reconciliation'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_integrations')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const status = new URL(req.url).searchParams.get('status') ?? 'OPEN'
  const admin = await createAdminClient()
  return NextResponse.json(await getReviewQueue(admin, ctx.businessId, status))
}
