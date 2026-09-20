// @ts-nocheck
// H46–H53 — provider-neutral category→account mapping. Architecture
// only: nothing here calls Xero, QuickBooks, or any accounting API. A
// mapping is just a label attached to a category, surfaced as an extra
// column on the expenses export when set.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_finance_summary')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data } = await admin.from('finance_account_mappings').select('*').eq('business_id', ctx.businessId)
  return NextResponse.json(data ?? [])
}

// Body: { category, account_code?, account_name? }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_finance_settings')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  if (!body.category) return NextResponse.json({ error: 'category required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data, error } = await admin.from('finance_account_mappings').upsert({
    business_id: ctx.businessId, category: body.category, account_code: body.account_code ?? null, account_name: body.account_name ?? null, updated_by: ctx.userId, updated_at: new Date().toISOString(),
  }, { onConflict: 'business_id,category' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
