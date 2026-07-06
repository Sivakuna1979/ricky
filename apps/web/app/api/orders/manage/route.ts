// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAIL = 'sivakuna@icloud.com'
const ALLOWED_STATUS = ['pending', 'ready', 'completed', 'cancelled']
const ALLOWED_PAYMENT = ['cash_at_van', 'card_at_van']

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
    const { data: order } = await supabase.from('orders').select('van_id').eq('id', id).single()
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
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to update order' }, { status: 500 })
  }
}
