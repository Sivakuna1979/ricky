// @ts-nocheck
// L11 — provider-neutral terminal metadata. Dormant infrastructure: a
// business can register/label/assign a terminal record now, ready for
// when a provider is approved and connected, but nothing here talks to a
// real card reader (no provider is connected, so `connection_id` will
// always be null and `status` will stay 'UNASSIGNED' until L-B).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { assertVanAllowed } from '@/lib/ai/context'
import { PAYMENT_PROVIDERS } from '@/lib/payments/types'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_integrations')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data } = await admin.from('payment_terminals').select('*, vans(name)').eq('business_id', ctx.businessId).order('created_at', { ascending: false })
  return NextResponse.json(data ?? [])
}

// Body: { label, provider, van_id? }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_payment_integrations')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  if (!body.label) return NextResponse.json({ error: 'label is required' }, { status: 400 })
  if (!PAYMENT_PROVIDERS.includes(body.provider)) return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  if (body.van_id) {
    try { assertVanAllowed(ctx, body.van_id) } catch { return NextResponse.json({ error: 'Not authorized for that van' }, { status: 403 }) }
  }

  const admin = await createAdminClient()
  const { data, error } = await admin.from('payment_terminals').insert({
    business_id: ctx.businessId, van_id: body.van_id ?? null, provider: body.provider,
    label: body.label, status: 'UNASSIGNED',
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent(admin, { actorId: ctx.userId, action: 'integrations.terminal_registered', entityType: 'payment_terminals', entityId: data.id, newValues: data })
  return NextResponse.json(data, { status: 201 })
}
