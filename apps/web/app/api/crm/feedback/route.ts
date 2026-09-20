// @ts-nocheck
// I45 — customer feedback submission. Public/unauthenticated, like
// /receipt/[id] and /order-status/[vanId] elsewhere in this app — the
// order_id itself (an unguessable UUID) is the capability that proves
// the submitter is that order's customer, since most orders have no
// login to check against. Never auto-published (I46) — is_published
// defaults false; a business must explicitly publish it as a public
// review.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Body: { order_id, rating, comment? }
export async function POST(req: NextRequest) {
  const { order_id, rating, comment } = await req.json().catch(() => ({}))
  if (!order_id || !rating || rating < 1 || rating > 5) return NextResponse.json({ error: 'order_id and a rating from 1-5 are required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: order } = await admin.from('orders').select('id, van_id, guest_name, guest_phone, guest_email, customer_id, vans(business_id)').eq('id', order_id).maybeSingle()
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const { data: existing } = await admin.from('reviews').select('id').eq('order_id', order_id).maybeSingle()
  if (existing) return NextResponse.json({ error: 'Feedback was already submitted for this order' }, { status: 409 })

  const { data: review, error } = await admin.from('reviews').insert({
    van_id: order.van_id, business_id: order.vans?.business_id ?? null, order_id, customer_id: order.customer_id ?? null,
    guest_name: order.guest_name ?? null, guest_phone: order.guest_phone ?? null, guest_email: order.guest_email ?? null,
    rating, comment: comment?.trim() || null, is_published: false,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, review_id: review.id })
}
