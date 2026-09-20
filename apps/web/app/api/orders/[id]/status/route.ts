// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { deductStockForOrder, restoreStockForOrder } from '@/lib/stockDeduction'
import { findOrCreateCrmCustomerForOrder } from '@/lib/crm/identity'
import { earnLoyaltyForOrder, reverseLoyaltyForOrder } from '@/lib/crm/loyalty'
import { qualifyReferral } from '@/lib/crm/referrals'

const schema = z.object({
  status: z.enum(['accepted', 'preparing', 'ready', 'collected', 'cancelled']),
  cancel_reason: z.string().optional(),
})

const STATUS_TIMESTAMP: Record<string, string> = {
  accepted: 'accepted_at',
  preparing: 'preparing_at',
  ready: 'ready_at',
  collected: 'collected_at',
  cancelled: 'cancelled_at',
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { status, cancel_reason } = parsed.data
  const timestampField = STATUS_TIMESTAMP[status]

  const updateData: Record<string, unknown> = {
    status,
    [timestampField]: new Date().toISOString(),
  }
  if (cancel_reason) updateData.cancel_reason = cancel_reason

  const { data, error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Automatic stock deduction (Phase C8) — optional per business, and a
  // no-op if nothing is configured; must never fail the status update.
  // Phase I — CRM identity tracking, loyalty earn/reverse and referral
  // qualification hook into this exact same point, the one place every
  // channel (online, guest, POS — see the Phase I audit note fixing
  // POS's hand-over to route through here, WhatsApp) transitions an
  // order to 'collected'/'cancelled'. None of this may ever fail the
  // status update itself.
  if (status === 'collected' || status === 'cancelled') {
    const admin = await createAdminClient()
    const { data: actor } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    try {
      if (status === 'collected') await deductStockForOrder(admin, params.id, actor?.id)
      if (status === 'cancelled') await restoreStockForOrder(admin, params.id, actor?.id)
    } catch (_e) {}

    try {
      const { data: van } = await admin.from('vans').select('business_id').eq('id', data.van_id).maybeSingle()
      const businessId = van?.business_id
      if (businessId) {
        if (status === 'collected') {
          // CRM identity tracking is unconditional (base feature) —
          // loyalty earning and referral qualification are opt-in layers
          // on top of it, checked inside their own functions.
          await findOrCreateCrmCustomerForOrder(admin, businessId, data)
          await earnLoyaltyForOrder(admin, businessId, { id: data.id, van_id: data.van_id, source: data.source, total: data.total, guest_phone: data.guest_phone, guest_email: data.guest_email, guest_name: data.guest_name, customer_id: data.customer_id })
          if (data.referral_code_used) await qualifyReferral(admin, businessId, data.referral_code_used, data)
        }
        if (status === 'cancelled') {
          await reverseLoyaltyForOrder(admin, businessId, params.id, 'Order cancelled')
        }
      }
    } catch (_e) {}
  }

  // Notify customer
  await supabase.functions.invoke('send-notification', {
    body: { type: 'order_status_update', order_id: params.id, status },
  })

  return NextResponse.json(data)
}
