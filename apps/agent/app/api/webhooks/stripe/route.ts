import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Syncs Stripe subscription state back onto the workspace.
export async function POST(req: NextRequest) {
  const stripe = getStripe()
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const raw = await req.text()

  let event
  try {
    event = secret && sig ? stripe.webhooks.constructEvent(raw, sig, secret) : JSON.parse(raw)
  } catch (e) {
    return NextResponse.json({ error: `Webhook signature failed: ${(e as Error).message}` }, { status: 400 })
  }

  const supabase = createAdminClient()

  async function applyToWorkspace(workspaceId: string, fields: Record<string, unknown>) {
    if (!workspaceId) return
    await supabase.from('workspaces').update(fields).eq('id', workspaceId)
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as any
      await applyToWorkspace(s.metadata?.workspace_id, {
        plan: s.metadata?.plan ?? 'pro',
        subscription_status: 'active',
        stripe_subscription_id: s.subscription,
        stripe_customer_id: s.customer,
      })
      break
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const sub = event.data.object as any
      await applyToWorkspace(sub.metadata?.workspace_id, {
        plan: sub.metadata?.plan ?? undefined,
        subscription_status: sub.status,
        stripe_subscription_id: sub.id,
      })
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as any
      await applyToWorkspace(sub.metadata?.workspace_id, {
        plan: 'free',
        subscription_status: 'canceled',
      })
      break
    }
  }

  return NextResponse.json({ received: true })
}
