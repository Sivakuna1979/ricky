// @ts-nocheck
// L-B — starts (or resumes) Stripe Connect Express onboarding for this
// business. Reuses an existing Express account id if one was already
// created (e.g. the owner navigated away mid-onboarding) rather than
// creating a duplicate account every time this is hit.
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { createExpressAccountAndOnboardingLink, isStripeConfigured } from '@/lib/payments/stripeTerminal'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'https://food-taxi.vercel.app'))
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_payment_integrations')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  if (!isStripeConfigured()) return NextResponse.json({ error: 'Stripe is not configured on this deployment.' }, { status: 501 })

  const admin = await createAdminClient()
  const { data: business } = await admin.from('businesses').select('name').eq('id', ctx.businessId).maybeSingle()
  const { data: existing } = await admin.from('payment_provider_connections').select('id, external_account_id').eq('business_id', ctx.businessId).eq('provider', 'STRIPE_TERMINAL').maybeSingle()

  try {
    const { accountId, url } = await createExpressAccountAndOnboardingLink({
      businessId: ctx.businessId, businessName: business?.name ?? 'FoodTaxi business', existingAccountId: existing?.external_account_id ?? null,
    })

    await admin.from('payment_provider_connections').upsert({
      business_id: ctx.businessId, provider: 'STRIPE_TERMINAL', status: 'ACTION_REQUIRED',
      external_account_id: accountId, connected_by: ctx.userId, last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: 'business_id,provider' })

    return NextResponse.redirect(url)
  } catch (e: any) {
    return NextResponse.json({ error: 'Could not start Stripe onboarding.' }, { status: 500 })
  }
}
