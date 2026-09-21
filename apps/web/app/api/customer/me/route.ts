// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireCustomer, claimGuestOrdersByEmail } from '@/lib/customer/identity'

// GET /api/customer/me — the account hub's entry point. Also performs the
// safe, deterministic guest-order claim (J8) on every call: idempotent
// (already-claimed orders are excluded by the `customer_id IS NULL` guard
// in claimGuestOrdersByEmail), so calling this repeatedly is harmless.
export async function GET() {
  const supabase = await createClient()
  const admin = await createAdminClient()
  const ctx = await requireCustomer(supabase, admin)
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  let claimed = 0
  try {
    const result = await claimGuestOrdersByEmail(admin, ctx.customer.id, ctx.email)
    claimed = result.claimed
  } catch { /* claiming must never break loading the account hub */ }

  return NextResponse.json({
    email: ctx.email,
    full_name: ctx.fullName,
    customer_id: ctx.customer.id,
    newly_claimed_orders: claimed,
  })
}
