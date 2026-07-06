// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

async function restGet(key: string, path: string) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
}

export async function GET() {
  const out: any = {}
  const key = SVC && SVC !== ANON ? SVC : ANON
  out.using_key = key === SVC ? 'service_role' : 'anon'

  // 1. Latest orders in the database (raw, bypassing the app)
  const latest = await restGet(key, 'orders?select=id,order_number,van_id,status,total,guest_name,created_at&order=created_at.desc&limit=5')
  out.latest_orders = latest.ok ? latest.data : `FAIL ${latest.status}: ${JSON.stringify(latest.data)}`

  // 2. Signed-in user + their vans (what the Orders page filters by)
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    out.signed_in_as = user?.email ?? 'NOT SIGNED IN'
    const { data: myVans, error: rpcErr } = await supabase.rpc('my_van_ids')
    out.my_van_ids = rpcErr ? `FAIL: ${JSON.stringify(rpcErr)}` : myVans

    // 3. The exact query the Orders dashboard runs, as the signed-in user
    const ids = (myVans ?? []).map((v: any) => (typeof v === 'string' ? v : v.my_van_ids ?? v.id))
    if (ids.length) {
      const { data: visible, error } = await supabase
        .from('orders').select('id, order_number, van_id, status, created_at')
        .in('van_id', ids).order('created_at', { ascending: false }).limit(5)
      out.orders_visible_to_owner = error ? `FAIL: ${JSON.stringify(error)}` : visible
    } else {
      out.orders_visible_to_owner = 'SKIP: no van ids for this user'
    }
  } catch (e: any) {
    out.session_check = `FAIL: ${e.message}`
  }

  // 4. Verdict
  const rawCount = Array.isArray(out.latest_orders) ? out.latest_orders.length : -1
  const visCount = Array.isArray(out.orders_visible_to_owner) ? out.orders_visible_to_owner.length : -1
  out.verdict = rawCount === 0
    ? 'No orders exist in the database — the insert is still failing.'
    : rawCount > 0 && visCount === 0
      ? 'Orders EXIST but the owner cannot see them — van_id mismatch or read policy issue. Compare van_id in latest_orders with my_van_ids.'
      : rawCount > 0 && visCount > 0
        ? '✅ Orders exist and are visible — the Orders page should show them.'
        : 'See errors above.'

  return NextResponse.json(out)
}
