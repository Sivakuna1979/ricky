// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Public, no-login order-status board — like the numbered board in a fast
// food shop. Only exposes what's already visible to anyone waiting at the
// counter (order number, first name, status), keyed by van_id which is
// already public (used in /pos-display/[vanId] and receipt links).
export async function GET(_req: NextRequest, { params }: { params: { vanId: string } }) {
  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('orders')
    .select('id, order_number, guest_name, status, created_at')
    .eq('van_id', params.vanId)
    .in('status', ['preparing', 'ready'])
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const orders = data ?? []
  return NextResponse.json({
    preparing: orders.filter(o => o.status === 'preparing'),
    ready: orders.filter(o => o.status === 'ready'),
  })
}
