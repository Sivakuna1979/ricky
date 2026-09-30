import { NextResponse } from 'next/server'
import { getViewer } from '@/lib/auth/viewer'
import { supabaseAdmin } from '@/lib/auth/admin'
import { getStripe } from '@/lib/billing/stripe'

export const runtime = 'nodejs'

/** Stripe customer portal: update card, view invoices, cancel. */
export async function POST(req: Request) {
  const origin = new URL(req.url).origin
  const stripe = getStripe()
  const db = supabaseAdmin()
  const viewer = await getViewer()
  if (!stripe || !db || !viewer.user) return NextResponse.redirect(`${origin}/account`, 303)
  const { data: row } = await db.from('users').select('stripe_customer_id').eq('id', viewer.user.id).maybeSingle()
  if (!row?.stripe_customer_id) return NextResponse.redirect(`${origin}/pricing`, 303)
  const portal = await stripe.billingPortal.sessions.create({ customer: row.stripe_customer_id, return_url: `${origin}/account` })
  return NextResponse.redirect(portal.url, 303)
}
