// @ts-nocheck
import { AdminShell } from '../_shared'
import { createClient } from '@/lib/supabase/server'

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

  const statusBadge = (status: string) => {
    const map: Record<string, [string, string]> = {
      completed: ['#10b981', 'rgba(16,185,129,.15)'],
      pending:   ['#fbbf24', 'rgba(251,191,36,.15)'],
      preparing: ['#60a5fa', 'rgba(96,165,250,.15)'],
      cancelled: ['#ef4444', 'rgba(239,68,68,.15)'],
    }
    const [color, bg] = map[status] ?? ['rgba(255,255,255,.4)', 'rgba(255,255,255,.07)']
    return (
      <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:20, color, background:bg }}>{status ?? 'pending'}</span>
    )
  }

  return (
    <AdminShell active="/admin/orders">
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#fff' }}>Orders</h1>
        <p style={{ fontSize:13, color:'rgba(255,255,255,.4)', margin:0 }}>{orders.length} orders found</p>
      </div>

      <div style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:14, overflow:'hidden' }}>
        {orders.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'rgba(255,255,255,.3)', fontSize:14 }}>No orders yet</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid rgba(255,255,255,.07)', background:'rgba(255,255,255,.02)' }}>
                {['Order ID', 'Status', 'Total', 'Date'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'12px 16px', color:'rgba(255,255,255,.35)', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o: any) => (
                <tr key={o.id} style={{ borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                  <td style={{ padding:'12px 16px', color:'rgba(255,255,255,.5)', fontFamily:'monospace', fontSize:12 }}>{o.id?.slice(0,8)}…</td>
                  <td style={{ padding:'12px 16px' }}>{statusBadge(o.status)}</td>
                  <td style={{ padding:'12px 16px', fontWeight:700, color:'#10b981' }}>{o.total != null ? `£${Number(o.total).toFixed(2)}` : '—'}</td>
                  <td style={{ padding:'12px 16px', color:'rgba(255,255,255,.35)', fontSize:12 }}>{o.created_at ? new Date(o.created_at).toLocaleDateString('en-GB') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  )
}
