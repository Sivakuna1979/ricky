// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_integrations')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const status = new URL(req.url).searchParams.get('status')
  const admin = await createAdminClient()
  let query = admin.from('accounting_sync_jobs').select('*').eq('business_id', ctx.businessId).order('created_at', { ascending: false }).limit(100)
  if (status) query = query.eq('status', status)
  const { data } = await query
  return NextResponse.json(data ?? [])
}
