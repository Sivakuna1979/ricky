// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'

// J68/J69 — minimal, privacy-conscious funnel analytics. No cookies, no
// fingerprinting, no PII accepted or stored. session_token (if provided)
// is a client-generated, non-identifying random value used only to dedupe
// a single funnel pass in the business dashboard's funnel view.
const eventSchema = z.object({
  event_type: z.enum([
    'menu_view', 'cart_start', 'checkout_start', 'order_completed',
    'install_prompt_shown', 'install_prompt_accepted', 'install_prompt_dismissed',
    'reorder_used', 'loyalty_wallet_view', 'qr_scan',
  ]),
  business_id: z.string().uuid().optional(),
  van_id: z.string().uuid().optional(),
  session_token: z.string().max(64).optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const parsed = eventSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 })

  try {
    const admin = await createAdminClient()
    await admin.from('customer_events').insert({
      event_type: parsed.data.event_type,
      business_id: parsed.data.business_id ?? null,
      van_id: parsed.data.van_id ?? null,
      session_token: parsed.data.session_token ?? null,
    })
  } catch {
    // Analytics must never break the customer experience.
  }
  return NextResponse.json({ ok: true })
}
