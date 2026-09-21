// @ts-nocheck
// L-B — a Stripe Terminal "Location" is required before a reader can be
// registered against it. One location per van is the natural mapping for
// a food-truck business (each van is its own physical selling location).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { assertVanAllowed } from '@/lib/ai/context'
import { createTerminalLocation } from '@/lib/payments/stripeTerminal'

// Body: { van_id, line1, city, postal_code }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_payment_integrations')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  if (!body.van_id || !body.line1 || !body.city || !body.postal_code) return NextResponse.json({ error: 'van_id, line1, city and postal_code are required' }, { status: 400 })
  try { assertVanAllowed(ctx, body.van_id) } catch { return NextResponse.json({ error: 'Not authorized for that van' }, { status: 403 }) }

  const admin = await createAdminClient()
  const { data: connection } = await admin.from('payment_provider_connections').select('id, external_account_id, status').eq('business_id', ctx.businessId).eq('provider', 'STRIPE_TERMINAL').maybeSingle()
  if (!connection || connection.status !== 'CONNECTED') return NextResponse.json({ error: 'Stripe Terminal is not connected for this business yet.' }, { status: 409 })

  const { data: van } = await admin.from('vans').select('id, name').eq('id', body.van_id).eq('business_id', ctx.businessId).maybeSingle()
  if (!van) return NextResponse.json({ error: 'Van not found' }, { status: 404 })

  try {
    const locationId = await createTerminalLocation(connection.external_account_id, {
      displayName: van.name, line1: body.line1, city: body.city, postalCode: body.postal_code,
    })
    // No unique constraint on (business_id, van_id, provider) — update in
    // place if a row already exists for this van/provider, else insert.
    const { data: existingTerminal } = await admin.from('payment_terminals').select('id').eq('business_id', ctx.businessId).eq('van_id', van.id).eq('provider', 'STRIPE_TERMINAL').maybeSingle()
    const row = { business_id: ctx.businessId, van_id: van.id, connection_id: connection.id, provider: 'STRIPE_TERMINAL', provider_device_id: locationId, label: `${van.name} — Stripe Terminal`, status: 'UNASSIGNED', updated_at: new Date().toISOString() }
    const { data: terminal, error } = existingTerminal
      ? await admin.from('payment_terminals').update(row).eq('id', existingTerminal.id).select().single()
      : await admin.from('payment_terminals').insert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ...terminal, stripe_location_id: locationId }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: 'Could not create the Stripe Terminal location.' }, { status: 500 })
  }
}
