import { NextRequest, NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/workspace'
import { getStripe, stripeConfigured } from '@/lib/stripe'
import { getPlan } from '@/lib/plans'
import { appUrl } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: 'Billing is not configured.' }, { status: 503 })
  }

  const { workspace, email } = await getCurrentContext()
  if (!workspace) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { plan: planId } = await req.json()
  const plan = getPlan(planId)
  if (plan.id === 'free' || !plan.stripePriceEnv) {
    return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 })
  }
  const priceId = process.env[plan.stripePriceEnv]
  if (!priceId) {
    return NextResponse.json({ error: `Missing price id (${plan.stripePriceEnv}).` }, { status: 500 })
  }

  const stripe = getStripe()

  // Ensure a Stripe customer exists for this workspace.
  let customerId = workspace.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: email ?? undefined,
      metadata: { workspace_id: workspace.id },
    })
    customerId = customer.id
    const supabase = await createClient()
    await supabase.from('workspaces').update({ stripe_customer_id: customerId }).eq('id', workspace.id)
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: appUrl('/dashboard/billing?success=1'),
    cancel_url: appUrl('/dashboard/billing?canceled=1'),
    metadata: { workspace_id: workspace.id, plan: plan.id },
    subscription_data: { metadata: { workspace_id: workspace.id, plan: plan.id } },
  })

  return NextResponse.json({ url: session.url })
}
