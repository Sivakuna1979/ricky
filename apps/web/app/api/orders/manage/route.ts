// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAIL = 'sivakuna@icloud.com'
const ALLOWED_STATUS = ['pending', 'ready', 'completed', 'cancelled']
const ALLOWED_PAYMENT = ['cash_at_van', 'card_at_van']

// UK mobile numbers: 07xxx -> +447xxx
function normalizePhone(raw: string) {
  const digits = (raw ?? '').replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('07')) return `+44${digits.slice(1)}`
  if (digits.startsWith('44')) return `+${digits}`
  return digits ? `+${digits}` : ''
}

// Sends an SMS via Twilio. Returns 'sent', 'not_configured' or an error string.
async function sendSms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER
  if (!sid || !token || !from || sid.includes('...')) return 'not_configured'
  const phone = normalizePhone(to)
  if (!phone) return 'no_phone'
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phone, From: from, Body: body }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return `sms_failed: ${err.message ?? res.status}`
    }
    return 'sent'
  } catch (e: any) {
    return `sms_failed: ${e.message}`
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, status, payment_method } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    if (status && !ALLOWED_STATUS.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    if (payment_method && !ALLOWED_PAYMENT.includes(payment_method)) return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

    // The order must belong to one of the signed-in user's vans.
    const { data: order } = await supabase
      .from('orders')
      .select('van_id, order_number, guest_name, guest_phone, pickup_location, vans(name)')
      .eq('id', id)
      .single()
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    if (user.email !== SUPER_ADMIN_EMAIL) {
      const { data: myVans } = await supabase.rpc('my_van_ids')
      const ids = (myVans ?? []).map((v: any) => (typeof v === 'string' ? v : v.my_van_ids ?? v.id))
      if (!ids.includes(order.van_id)) {
        return NextResponse.json({ error: 'You do not have permission to manage this order.' }, { status: 403 })
      }
    }

    const updates: any = {}
    if (status) updates.status = status
    if (payment_method) updates.payment_method = payment_method
    if (!Object.keys(updates).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    let { error } = await supabase.from('orders').update(updates).eq('id', id)
    if (error && (error.code === '42501' || /permission denied|row-level security/i.test(error.message))) {
      const admin = await createAdminClient()
      const retry = await admin.from('orders').update(updates).eq('id', id)
      error = retry.error
    }
    if (error) throw new Error(error.message)

    // Text the customer when their order state changes.
    let sms = 'skipped'
    if (order.guest_phone && (status === 'ready' || status === 'cancelled')) {
      const vanName = (order as any).vans?.name ?? 'the food van'
      const ref = (order.order_number ?? String(id).slice(0, 8)).toUpperCase()
      const firstName = (order.guest_name ?? '').split(' ')[0]
      const msg = status === 'ready'
        ? `Hi${firstName ? ` ${firstName}` : ''}! Your order #${ref} from ${vanName} is READY to collect${order.pickup_location ? ` at ${order.pickup_location}` : ''}. See you soon! 🍟`
        : `Hi${firstName ? ` ${firstName}` : ''}, sorry — your order #${ref} from ${vanName} has been cancelled. Please contact the van if you have questions.`
      sms = await sendSms(order.guest_phone, msg)
    }

    return NextResponse.json({ ok: true, sms })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to update order' }, { status: 500 })
  }
}
