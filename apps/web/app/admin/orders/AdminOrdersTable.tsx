// @ts-nocheck
'use client'
import { useState } from 'react'

function statusBadge(status: string) {
  const map: Record<string, [string, string]> = {
    completed: ['#10b981', 'rgba(16,185,129,.15)'],
    collected: ['#10b981', 'rgba(16,185,129,.15)'],
    pending:   ['#fbbf24', 'rgba(251,191,36,.15)'],
    accepted:  ['#60a5fa', 'rgba(96,165,250,.15)'],
    preparing: ['#60a5fa', 'rgba(96,165,250,.15)'],
    ready:     ['#34d399', 'rgba(52,211,153,.15)'],
    cancelled: ['#ef4444', 'rgba(239,68,68,.15)'],
  }
  const [color, bg] = map[status] ?? ['rgba(255,255,255,.4)', 'rgba(255,255,255,.07)']
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:20, color, background:bg }}>{status ?? 'pending'}</span>
  )
}

export function AdminOrdersTable({ orders: initialOrders }: any) {
  const [orders, setOrders] = useState(initialOrders)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const deleteOrder = async (id: string) => {
    if (!confirm(`Permanently delete order ${id.slice(0, 8)}…? This cannot be undone and leaves no record — test data only, never real orders.`)) return
    setDeletingId(id)
    const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' })
    if (res.ok) setOrders((prev: any[]) => prev.filter(o => o.id !== id))
    else { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Delete failed') }
    setDeletingId(null)
  }

  if (orders.length === 0) {
    return <div style={{ padding:40, textAlign:'center', color:'rgba(255,255,255,.3)', fontSize:14 }}>No orders yet</div>
  }

  return (
    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
      <thead>
        <tr style={{ borderBottom:'1px solid rgba(255,255,255,.07)', background:'rgba(255,255,255,.02)' }}>
          {['Order ID', 'Status', 'Total', 'Date', ''].map(h => (
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
            <td style={{ padding:'12px 16px' }}>
              <button onClick={() => deleteOrder(o.id)} disabled={deletingId === o.id}
                style={{ fontSize:11, fontWeight:700, color:'#ef4444', background:'none', border:'1px solid rgba(239,68,68,.35)', borderRadius:8, padding:'5px 10px', cursor:'pointer', opacity: deletingId === o.id ? 0.5 : 1, whiteSpace:'nowrap' }}>
                {deletingId === o.id ? '…' : '🗑 Delete'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
