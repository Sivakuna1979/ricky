// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const getResend = () => new Resend(process.env.RESEND_API_KEY ?? 're_placeholder')

// POST /api/orders/[id]/email-receipt — emails the receipt for one order.
// Public (no login) like the receipt page itself: you need the order's
// UUID to call this, same as you need it to view the receipt at all.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { email } = await req.json().catch(() => ({}))
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email is not configured for this site yet' }, { status: 503 })
  }

  const admin = await createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('*, order_items(*), vans(name, businesses(name))')
    .eq('id', params.id)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const items = order.order_items ?? []
  const bizName = order.vans?.businesses?.name ?? order.vans?.name ?? 'FoodTaxi'
  const ref = (order.order_number ?? order.id.slice(0, 8)).toUpperCase()
  const lines = items.map((it: any) => `${it.quantity}x ${it.name} — £${Number(it.item_total).toFixed(2)}`).join('\n')
  const receiptUrl = `https://food-taxi.vercel.app/receipt/${order.id}`

  const text = `Receipt from ${bizName}\nOrder #${ref}\n${new Date(order.created_at).toLocaleString('en-GB')}\n\n${lines}\n\nTotal: £${Number(order.total).toFixed(2)}\n\nView online: ${receiptUrl}\n\nThank you!`

  try {
    await getResend().emails.send({
      from: process.env.EMAIL_FROM ?? 'noreply@foodtaxi.co.uk',
      to: email,
      subject: `Your receipt from ${bizName} — #${ref}`,
      text,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Could not send email' }, { status: 500 })
  }

  // Best-effort: remember the email against the order for next time.
  if (!order.guest_email) {
    await admin.from('orders').update({ guest_email: email }).eq('id', order.id).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
