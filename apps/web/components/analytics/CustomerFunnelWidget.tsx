// @ts-nocheck
'use client'
// J69 — a small, self-contained aggregate funnel card. Deliberately
// separate from the existing (large, pre-Phase-J) AnalyticsDashboard
// component rather than edited into it, to avoid any risk of regressing
// that component while adding this.
import { useEffect, useState } from 'react'

const LABELS: Record<string, string> = {
  menu_view: 'Menu views', cart_start: 'Started a cart', checkout_start: 'Started checkout', order_completed: 'Completed orders',
}

export function CustomerFunnelWidget({ businessId }: { businessId: string }) {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/analytics/funnel?business_id=${businessId}&days=30`).then(r => r.ok ? r.json() : null).then(setData).catch(() => {})
  }, [businessId])

  if (!data) return null
  const max = Math.max(1, ...data.funnel.map((f: any) => f.count))

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20, marginTop: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 2 }}>Customer Funnel (last {data.days} days)</div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>Raw counts of recorded customer events — not estimated.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.funnel.map((f: any) => (
          <div key={f.type}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: '#555', fontWeight: 600 }}>{LABELS[f.type] ?? f.type}</span>
              <span style={{ color: '#111', fontWeight: 800 }}>{f.count}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: '#f3f4f6', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(f.count / max) * 100}%`, background: 'linear-gradient(90deg,#f97316,#dc2626)', borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
