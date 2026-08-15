// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Public, no-login — a customer who placed an online order taps "I'm on my
// way" from their order link (the id itself, an unguessable UUID, is the
// only credential needed — same trust model as the public receipt page).
// Lets the kitchen start cooking right when the customer actually sets off,
// rather than guessing from order time, which is misleading for anything
// ordered ahead of a later pickup.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await createAdminClient()
  const { data: order } = await admin.from('orders').select('id, status, checked_in_at').eq('id', params.id).maybeSingle()
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (!['pending', 'accepted', 'preparing'].includes(order.status)) {
    return NextResponse.json({ error: 'This order can no longer be checked in.' }, { status: 400 })
  }
  if (order.checked_in_at) return NextResponse.json({ ok: true, checked_in_at: order.checked_in_at })

  const checked_in_at = new Date().toISOString()
  const { error } = await admin.from('orders').update({ checked_in_at }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, checked_in_at })
}
