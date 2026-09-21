// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

const money = (n: any) => `£${Number(n ?? 0).toFixed(2)}`

function toCsv(rows: (string | number)[][]) {
  return rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
}

export function OwnerReport({ businessName }: { businessName: string }) {
  const [overview, setOverview] = useState<any>(null)
  const [week, setWeek] = useState<any>(null)

  useEffect(() => {
    fetch('/api/command-centre/overview').then((r) => r.json()).then(setOverview).catch(() => {})
    fetch('/api/command-centre/comparisons?period=week').then((r) => r.json()).then(setWeek).catch(() => {})
  }, [])

  const downloadCsv = () => {
    if (!overview) return
    const rows: (string | number)[][] = [
      ['FoodTaxi Owner Report', businessName, overview.date],
      [],
      ['Metric', 'Today'],
      ['Revenue', overview.kpi_today.revenue],
      ['Orders', overview.kpi_today.orders],
      ['Average order value', overview.kpi_today.average_order_value],
      ['Known gross contribution', overview.kpi_today.known_gross_contribution],
      ['Wastage cost', overview.kpi_today.wastage_cost],
      ['New customers', overview.kpi_today.new_customers],
      ['Returning customers', overview.kpi_today.returning_customers],
      [],
      ['Open attention items', overview.exceptions.length],
      ...overview.exceptions.map((e: any) => [e.priority, e.title, e.detail]),
    ]
    const blob = new Blob([toCsv(rows)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `foodtaxi-owner-report-${overview.date}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (!overview) return <div style={{ color: '#6b7280' }}>Loading…</div>

  return (
    <div>
      <style>{`@media print { .no-print { display: none !important; } body { background: #fff !important; } }`}</style>
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => window.print()} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🖨️ Print / Save as PDF</button>
        <button onClick={downloadCsv} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f5f6fa', color: '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>⬇ Download CSV</button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
        <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>{businessName} — Owner Report</h1>
        <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>Generated {overview.date} · Private, not shared automatically</div>

        <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>Today</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
          <tbody>
            <tr><td style={{ padding: '4px 0' }}>Revenue</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{money(overview.kpi_today.revenue)}</td></tr>
            <tr><td style={{ padding: '4px 0' }}>Orders</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{overview.kpi_today.orders}</td></tr>
            <tr><td style={{ padding: '4px 0' }}>Average order value</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{money(overview.kpi_today.average_order_value)}</td></tr>
            <tr><td style={{ padding: '4px 0' }}>Known gross contribution ({overview.kpi_today.cogs_coverage_pct}% cost coverage)</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{money(overview.kpi_today.known_gross_contribution)}</td></tr>
            <tr><td style={{ padding: '4px 0' }}>Wastage</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{money(overview.kpi_today.wastage_cost)}</td></tr>
            <tr><td style={{ padding: '4px 0' }}>New / returning customers</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{overview.kpi_today.new_customers} / {overview.kpi_today.returning_customers}</td></tr>
          </tbody>
        </table>

        {week && (
          <>
            <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>This week vs last week</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
              <tbody>
                {Object.entries(week.comparisons).map(([k, c]: any) => (
                  <tr key={k}><td style={{ padding: '4px 0' }}>{k.replace(/_/g, ' ')}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{c.current}{c.delta_pct != null ? ` (${c.delta_pct >= 0 ? '+' : ''}${c.delta_pct}%)` : ` (${c.note || c.coverage})`}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>Open attention items ({overview.exceptions.length})</h2>
        {overview.exceptions.length === 0 ? <div style={{ fontSize: 13, color: '#6b7280' }}>Nothing outstanding.</div> : (
          <ul style={{ fontSize: 13, paddingLeft: 18 }}>
            {overview.exceptions.map((e: any) => <li key={e.dedupeKey} style={{ marginBottom: 4 }}><b>[{e.priority}]</b> {e.title} — {e.detail}</li>)}
          </ul>
        )}
      </div>
    </div>
  )
}
