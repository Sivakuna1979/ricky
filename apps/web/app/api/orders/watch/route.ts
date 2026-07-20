// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Lightweight poll target for new-order alerts on the business dashboard.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: myVans } = await supabase.rpc('my_van_ids')
  const ids = (myVans ?? []).map((v: any) => (typeof v === 'string' ? v : v.my_van_ids ?? v.id))
  if (!ids.length) return NextResponse.json({ pending: 0, latest: null })

  const { data } = await supabase
    .from('orders')
    .select('id, order_number, total, guest_name, created_at')
    .in('van_id', ids)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .in('van_id', ids)
    .eq('status', 'pending')

  return NextResponse.json({ pending: count ?? 0, latest: data?.[0] ?? null })
}
