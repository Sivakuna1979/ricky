// @ts-nocheck
// L-B — the Terminal Web SDK calls this once when initializing on the POS
// till, to get a short-lived connection token scoped to this business's
// own connected Stripe account. Never any longer-lived credential is ever
// sent to the browser.
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { createConnectionToken } from '@/lib/payments/stripeTerminal'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'use_pos')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: connection } = await admin.from('payment_provider_connections').select('external_account_id, status').eq('business_id', ctx.businessId).eq('provider', 'STRIPE_TERMINAL').maybeSingle()
  if (!connection || connection.status !== 'CONNECTED') return NextResponse.json({ error: 'Stripe Terminal is not connected for this business.' }, { status: 409 })

  try {
    const secret = await createConnectionToken(connection.external_account_id)
    return NextResponse.json({ secret })
  } catch (e: any) {
    return NextResponse.json({ error: 'Could not get a Terminal connection token.' }, { status: 500 })
  }
}
