// @ts-nocheck
import { AdminShell } from '../_shared'
import { createClient } from '@/lib/supabase/server'
import { AdminOrdersTable } from './AdminOrdersTable'

export const dynamic = 'force-dynamic'

export default async function AdminOrdersPage() {
  let orders: any[] = []
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('orders')
      .select('id, status, total, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    orders = data ?? []
  } catch {}

  return (
    <AdminShell active="/admin/orders">
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#fff' }}>Orders</h1>
        <p style={{ fontSize:13, color:'rgba(255,255,255,.4)', margin:0 }}>{orders.length} orders found</p>
      </div>

      <div style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:14, overflow:'hidden' }}>
        <AdminOrdersTable orders={orders} />
      </div>
    </AdminShell>
  )
}
