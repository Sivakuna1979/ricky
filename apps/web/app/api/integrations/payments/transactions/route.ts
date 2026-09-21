// @ts-nocheck
// L-B — recent provider transactions for the Integration Centre's refund
// UI. Read-only; refunds go through the separate request/confirm routes.
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_integrations')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data } = await admin.from('provider_transactions').select('id, provider, status, amount, currency, order_id, created_at').eq('business_id', ctx.businessId).order('created_at', { ascending: false }).limit(50)
  return NextResponse.json(data ?? [])
}
