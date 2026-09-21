// @ts-nocheck
// L35/L36 — Xero/QuickBooks account + tax-code mappings. Distinct from the
// older, provider-agnostic Phase H `finance_account_mappings` (a generic
// CSV-export label with no tax code) — this table is specifically for a
// real, connection-bound accounting sync. Never suggests a tax code
// itself (L37) — `tax_code` is only ever whatever a human enters here.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'

const CATEGORIES = ['sales', 'food_stock', 'packaging', 'fuel', 'vehicle', 'repairs', 'equipment', 'marketing', 'professional_fees', 'other']

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_integrations')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const provider = new URL(req.url).searchParams.get('provider')?.toUpperCase()
  const admin = await createAdminClient()
  let query = admin.from('accounting_account_mappings').select('*').eq('business_id', ctx.businessId)
  if (provider) query = query.eq('provider', provider)
  const { data } = await query
  return NextResponse.json(data ?? [])
}

// Body: { provider, category, external_account_id, external_account_name?, tax_code? }
// tax_code/tax advice disclaimer is surfaced in the UI, not enforced here — this route only ever
// stores exactly what a human entered.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_accounting_integrations')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const provider = body.provider?.toUpperCase()
  if (!['XERO', 'QUICKBOOKS'].includes(provider)) return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  if (!CATEGORIES.includes(body.category)) return NextResponse.json({ error: 'Unknown category' }, { status: 400 })
  if (!body.external_account_id) return NextResponse.json({ error: 'external_account_id is required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data, error } = await admin.from('accounting_account_mappings').upsert({
    business_id: ctx.businessId, provider, category: body.category,
    external_account_id: body.external_account_id, external_account_name: body.external_account_name ?? null,
    tax_code: body.tax_code ?? null, updated_by: ctx.userId, updated_at: new Date().toISOString(),
  }, { onConflict: 'business_id,provider,category' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
