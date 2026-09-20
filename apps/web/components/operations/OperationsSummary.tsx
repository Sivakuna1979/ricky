// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'

// Operations dashboard (C27) — extends the existing main dashboard rather
// than replacing it, per the Phase C spec.
export function OperationsSummary() {
  const [data, setData] = useState<any>(null)

  useEffect(() => { fetch('/api/operations/summary').then(r => r.json()).then(setData).catch(() => {}) }, [])

  if (!data) return null

  const tiles = [
    { label: 'LOW STOCK', value: data.low_stock, unit: data.low_stock === 1 ? 'item' : 'items', href: '/dashboard/stock', warn: data.low_stock > 0, icon: '⚠️' },
    { label: 'OUT OF STOCK', value: data.out_of_stock, unit: data.out_of_stock === 1 ? 'item' : 'items', href: '/dashboard/stock', warn: data.out_of_stock > 0, danger: true, icon: '❌' },
    { label: 'WASTAGE TODAY', value: `£${(data.wastage_today ?? 0).toFixed(2)}`, unit: '', href: '/dashboard/stock', warn: data.wastage_today > 0, icon: '🗑️' },
    { label: 'PURCHASE ORDERS', value: data.purchase_orders_awaiting, unit: 'awaiting delivery', href: '/dashboard/suppliers', warn: false, icon: '📦' },
    { label: 'STAFF WORKING TODAY', value: data.staff_working_today, unit: 'on shift', href: '/dashboard/team', warn: false, icon: '👥' },
    { label: 'VEHICLE ALERTS', value: data.vehicle_alerts, unit: data.vehicle_alerts === 1 ? 'due soon' : 'due soon', href: '/dashboard/fleet', warn: data.vehicle_alerts > 0, icon: '🔧' },
    { label: 'HYGIENE', value: data.hygiene_outstanding, unit: 'checks outstanding', href: '/dashboard/hygiene', warn: data.hygiene_outstanding > 0, icon: '🧼' },
  ]

  const anyAlert = tiles.some(t => t.warn)
  if (!anyAlert && data.purchase_orders_awaiting === 0 && data.staff_working_today === 0) return null // nothing worth showing yet

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 12 }}>Operations</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
        {tiles.filter(t => t.value !== 0 || t.label === 'STAFF WORKING TODAY').map(t => (
          <a key={t.label} href={t.href} style={{ textDecoration: 'none', display: 'block', padding: '12px 14px', borderRadius: 10, background: t.danger && t.warn ? '#fee2e2' : t.warn ? '#fef3c7' : '#f9fafb', border: '1px solid ' + (t.danger && t.warn ? '#fca5a5' : t.warn ? '#fcd34d' : '#f3f4f6') }}>
            <div style={{ fontSize: 18 }}>{t.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: t.danger && t.warn ? '#991b1b' : t.warn ? '#92400e' : '#111' }}>{t.value}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#888' }}>{t.label}{t.unit ? ` · ${t.unit}` : ''}</div>
          </a>
        ))}
      </div>
    </div>
  )
}
