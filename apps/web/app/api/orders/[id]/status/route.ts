import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

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

  // Notify customer
  await supabase.functions.invoke('send-notification', {
    body: { type: 'order_status_update', order_id: params.id, status },
  })

  return NextResponse.json(data)
}
