// @ts-nocheck
// I23 — vouchers. A promotional/discount instrument only, not a
// stored-value product (no cash-out, no balance beyond the one discount
// it carries).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_promotions')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data } = await admin.from('vouchers').select('*, crm_customers(display_name)').eq('business_id', ctx.businessId).order('issued_at', { ascending: false }).limit(200)
  return NextResponse.json(data ?? [])
}

// Body: { discount_type, discount_value, intended_customer_id?, expires_at? }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_promotions')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { discount_type, discount_value, intended_customer_id, expires_at } = await req.json()
  if (!discount_type || discount_value == null) return NextResponse.json({ error: 'discount_type and discount_value are required' }, { status: 400 })

  const admin = await createAdminClient()
  const code = `FTV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  const { data: voucher, error } = await admin.from('vouchers').insert({
    business_id: ctx.businessId, code, discount_type, discount_value, source: 'manual',
    intended_customer_id: intended_customer_id ?? null, expires_at: expires_at ?? null, created_by: ctx.userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent(admin, { actorId: ctx.userId, action: 'crm.voucher_issued', entityType: 'vouchers', entityId: voucher.id, newValues: voucher })
  return NextResponse.json(voucher, { status: 201 })
}
