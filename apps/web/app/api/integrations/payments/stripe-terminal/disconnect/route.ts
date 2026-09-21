// @ts-nocheck
// L-B — disconnect. Deliberately does NOT delete the Stripe Connect
// account itself (that has real payout/tax history a business may need
// later) — only marks FoodTaxi's own connection DISCONNECTED so no new
// Terminal charge can be created against it. Existing payment_terminals
// rows for this connection are unassigned rather than deleted.
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/auditLog'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_payment_integrations')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: connection } = await admin.from('payment_provider_connections').select('id').eq('business_id', ctx.businessId).eq('provider', 'STRIPE_TERMINAL').maybeSingle()
  if (!connection) return NextResponse.json({ error: 'Not connected' }, { status: 404 })

  await admin.from('payment_provider_connections').update({ status: 'DISCONNECTED', disconnected_at: new Date().toISOString() }).eq('id', connection.id)
  await admin.from('payment_terminals').update({ status: 'UNASSIGNED', connection_id: null }).eq('connection_id', connection.id)
  await logAuditEvent(admin, { actorId: ctx.userId, action: 'integrations.stripe_terminal_disconnected', entityType: 'payment_provider_connections', entityId: connection.id })

  return NextResponse.json({ ok: true })
}
