// @ts-nocheck
// L-B — a lightweight "is Stripe Terminal ready for this van" check for
// the POS till itself, gated on `use_pos` (not `view_integrations` — a
// till operator needs to know whether card-via-Terminal is available
// without needing Integration Centre access).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { assertVanAllowed } from '@/lib/ai/context'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'use_pos')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const vanId = new URL(req.url).searchParams.get('van_id')
  if (!vanId) return NextResponse.json({ error: 'van_id is required' }, { status: 400 })
  try { assertVanAllowed(ctx, vanId) } catch { return NextResponse.json({ error: 'Not authorized for that van' }, { status: 403 }) }

  const admin = await createAdminClient()
  const { data: connection } = await admin.from('payment_provider_connections').select('status').eq('business_id', ctx.businessId).eq('provider', 'STRIPE_TERMINAL').maybeSingle()
  const { data: terminal } = await admin.from('payment_terminals').select('id, label').eq('business_id', ctx.businessId).eq('van_id', vanId).eq('provider', 'STRIPE_TERMINAL').maybeSingle()

  return NextResponse.json({
    ready: connection?.status === 'CONNECTED' && Boolean(terminal),
    connection_status: connection?.status ?? 'DISCONNECTED',
    terminal_label: terminal?.label ?? null,
  })
}
