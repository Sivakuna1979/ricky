// @ts-nocheck
// L-B — the return_url after Stripe's hosted onboarding. Never trusts
// that arriving here means onboarding succeeded (Stripe redirects back
// regardless of outcome) — re-checks the account's real status directly
// with Stripe before ever marking the connection CONNECTED.
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { getAccountStatus } from '@/lib/payments/stripeTerminal'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://food-taxi.vercel.app'
const RETURN_TO = `${APP_URL}/dashboard/integrations`

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${APP_URL}/login`)
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.redirect(RETURN_TO)

  const admin = await createAdminClient()
  const { data: connection } = await admin.from('payment_provider_connections').select('id, external_account_id').eq('business_id', ctx.businessId).eq('provider', 'STRIPE_TERMINAL').maybeSingle()
  if (!connection?.external_account_id) return NextResponse.redirect(`${RETURN_TO}?error=no_stripe_terminal_account`)

  try {
    const result = await getAccountStatus(connection.external_account_id)
    await admin.from('payment_provider_connections').update({
      status: result.status, last_checked_at: new Date().toISOString(), last_error: result.disabledReason,
      connected_at: result.status === 'CONNECTED' ? new Date().toISOString() : undefined, updated_at: new Date().toISOString(),
    }).eq('id', connection.id)
    return NextResponse.redirect(`${RETURN_TO}?stripe_terminal=${result.status.toLowerCase()}`)
  } catch (e: any) {
    return NextResponse.redirect(`${RETURN_TO}?error=stripe_status_check_failed`)
  }
}
