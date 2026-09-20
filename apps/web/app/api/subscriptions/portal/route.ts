// @ts-nocheck
// ============================================================================
// ✅ PHASE B — Stripe Customer Portal session for the FoodTaxi Business
// subscription (manage payment method, cancel, view invoices). Reuses
// Stripe's own portal rather than rebuilding billing management UI, per
// Phase B7 guidance.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-06-20' })
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://food-taxi.vercel.app'

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Payments not configured yet — add STRIPE_SECRET_KEY in Vercel.' }, { status: 503 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    if (!userData) return NextResponse.json({ error: 'User profile not found' }, { status: 404 })

    const admin = await createAdminClient()
    const { data: business } = await admin
      .from('businesses').select('id, stripe_customer_id').eq('owner_id', userData.id).maybeSingle()
    if (!business) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

    const { data: sub } = await admin
      .from('subscriptions').select('stripe_customer_id').eq('business_id', business.id).maybeSingle()

    const customerId = sub?.stripe_customer_id || business.stripe_customer_id
    if (!customerId) {
      return NextResponse.json({ error: 'No billing account yet — start a subscription first.' }, { status: 404 })
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${APP_URL}/dashboard/billing`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Could not open billing portal' }, { status: 500 })
  }
}
