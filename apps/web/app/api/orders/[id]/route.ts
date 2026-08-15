// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAIL = 'sivakuna@icloud.com'

// GET /api/orders/[id] — public, no-login. Backs the customer's own order
// status page (/order/[id]); the id itself (an unguessable UUID) is the only
// credential, same trust model as the public receipt page. Deliberately
// excludes guest_phone/guest_email — those aren't needed there.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await createAdminClient()
  const { data: order, error } = await admin
    .from('orders')
    .select('id, order_number, status, pickup_location, pickup_time, checked_in_at, total, created_at, guest_name, order_items(name, quantity), vans(name)')
    .eq('id', params.id)
    .maybeSingle()
  // A real query error (e.g. a column from a migration that hasn't been run
  // yet) must never be reported as "not found" — that hides the actual
  // cause and makes a perfectly real order look like it doesn't exist.
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  return NextResponse.json(order)
}

// DELETE /api/orders/[id] — permanently removes an order (and its items,
// via ON DELETE CASCADE). Super-admin only, for wiping test/junk data
// before a real launch. Not exposed to ordinary business owners: real
// order history should be cancelled, never hard-deleted, so accounting/
// dispute records stay intact.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })

  const { data: userData } = await supabase.from('users').select('role').eq('auth_id', user.id).maybeSingle()
  if (user.email !== SUPER_ADMIN_EMAIL && userData?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
  }

  const admin = await createAdminClient()
  const { error } = await admin.from('orders').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
