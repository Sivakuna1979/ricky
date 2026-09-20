// @ts-nocheck
// I20 — promo codes. Discount calculation itself never happens here —
// this only stores the rule; lib/crm/discounts.ts is the one place a
// code is priced, at order creation.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_promotions')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: promos } = await admin.from('promo_codes').select('*').eq('business_id', ctx.businessId).order('created_at', { ascending: false })
  const ids = (promos ?? []).map((p: any) => p.id)
  const { data: redemptions } = ids.length ? await admin.from('promo_redemptions').select('promo_code_id').in('promo_code_id', ids) : { data: [] }
  const countByPromo: Record<string, number> = {}
  for (const r of redemptions ?? []) countByPromo[r.promo_code_id] = (countByPromo[r.promo_code_id] ?? 0) + 1
  return NextResponse.json((promos ?? []).map((p: any) => ({ ...p, redemption_count: countByPromo[p.id] ?? 0 })))
}

// Body matches promo_codes columns (see the Phase I migration).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_promotions')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const { code, discount_type, discount_value } = body
  if (!code?.trim() || !discount_type || discount_value == null) return NextResponse.json({ error: 'code, discount_type and discount_value are required' }, { status: 400 })
  if (discount_type === 'percentage' && (discount_value <= 0 || discount_value > 100)) return NextResponse.json({ error: 'Percentage must be between 1 and 100' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: promo, error } = await admin.from('promo_codes').insert({
    business_id: ctx.businessId, code: code.trim().toUpperCase(), description: body.description ?? null,
    discount_type, discount_value, starts_at: body.starts_at ?? null, ends_at: body.ends_at ?? null,
    min_spend: body.min_spend ?? 0, max_redemptions: body.max_redemptions ?? null, per_customer_limit: body.per_customer_limit ?? 1,
    eligible_van_ids: body.eligible_van_ids ?? null, eligible_channels: body.eligible_channels ?? null,
    new_customers_only: !!body.new_customers_only, created_by: ctx.userId,
  }).select().single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'A promo code with this name already exists.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAuditEvent(admin, { actorId: ctx.userId, action: 'crm.promo_created', entityType: 'promo_codes', entityId: promo.id, newValues: promo })
  return NextResponse.json(promo, { status: 201 })
}
