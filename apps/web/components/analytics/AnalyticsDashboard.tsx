// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts'

const CARD = { background: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: 20 }
const LABEL = { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' as const, marginBottom: 4 }

function StatBlock({ title, data }: any) {
  return (
    <div style={{ flex: 1, minWidth: 140, background: '#f9fafb', borderRadius: 12, padding: '14px 16px' }}>
      <div style={LABEL}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#111' }}>£{(data?.revenue ?? 0).toFixed(2)}</div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{data?.orders ?? 0} orders · £{(data?.averageOrderValue ?? 0).toFixed(2)} avg</div>
    </div>
  )
}

export function AnalyticsDashboard({ businessId }: { businessId: string }) {
  const [vanId, setVanId] = useState('all')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    fetch(`/api/analytics/summary?van_id=${vanId}`)
      .then(async res => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Failed to load analytics')
        setData(json)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [vanId])

  if (loading && !data) return <div style={{ padding: '40px 0', textAlign: 'center', color: '#888' }}>Loading analytics…</div>
  if (error) return <div style={{ ...CARD, color: '#991b1b' }}>Couldn't load analytics: {error}</div>
  if (!data) return null

  const hasAnyOrders = data.month.orders > 0 || data.revenueTrend.length > 0

  return (
    <div>
      {data.vans.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <select
            value={vanId}
            onChange={e => setVanId(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, fontWeight: 600, color: '#111', background: '#fff', minWidth: 160 }}
          >
            <option value="all">All Vans</option>
            {data.vans.map((v: any) => <option key={v.id} value={v.id}>{v.name || 'Unnamed Van'}</option>)}
          </select>
        </div>
      )}

      {!hasAnyOrders ? (
        <div style={{ ...CARD, textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 14, color: '#888' }}>No orders yet — analytics will appear here once you start taking orders.</div>
        </div>
      ) : (
        <>
          <div style={CARD}>
            <div style={{ ...LABEL, marginBottom: 12 }}>Performance</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <StatBlock title="Today" data={data.today} />
              <StatBlock title="This Week" data={data.week} />
              <StatBlock title="This Month" data={data.month} />
            </div>
          </div>

          {data.revenueTrend.length > 1 && (
            <div style={CARD}>
              <div style={LABEL}>Revenue trend (last {data.windowDays} days)</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <LineChart data={data.revenueTrend} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} width={40} />
                    <Tooltip formatter={(v: number) => [`£${v.toFixed(2)}`, 'Revenue']} />
                    <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ ...CARD, flex: 1, minWidth: 260 }}>
              <div style={LABEL}>Best sellers</div>
              {data.bestSellers.length === 0 ? (
                <div style={{ fontSize: 13, color: '#bbb', fontStyle: 'italic', padding: '8px 0' }}>No sales yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {data.bestSellers.map((it: any, i: number) => (
                    <div key={it.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: i < data.bestSellers.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <span style={{ color: '#333', fontWeight: 600 }}>{it.name}</span>
                      <span style={{ color: '#888' }}>×{it.quantity} · £{it.revenue.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ ...CARD, flex: 1, minWidth: 260 }}>
              <div style={LABEL}>Sales by day of week</div>
              <div style={{ width: '100%', height: 180, marginTop: 8 }}>
                <ResponsiveContainer>
                  <BarChart data={data.salesByDay}>
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={36} />
                    <Tooltip formatter={(v: number) => [`£${v.toFixed(2)}`, 'Revenue']} />
                    <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ ...CARD, flex: 1, minWidth: 220 }}>
              <div style={LABEL}>Payment methods</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {data.paymentMethods.length === 0 ? <div style={{ fontSize: 13, color: '#bbb', fontStyle: 'italic' }}>No data yet</div> :
                  data.paymentMethods.map((p: any) => (
                    <div key={p.method} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: '#333', textTransform: 'capitalize' }}>{p.method.replace(/_/g, ' ')}</span>
                      <span style={{ color: '#888' }}>£{p.revenue.toFixed(2)} ({p.count})</span>
                    </div>
                  ))}
              </div>
            </div>

            <div style={{ ...CARD, flex: 1, minWidth: 220 }}>
              <div style={LABEL}>Order source</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {data.sources.length === 0 ? <div style={{ fontSize: 13, color: '#bbb', fontStyle: 'italic' }}>No data yet</div> :
                  data.sources.map((s: any) => (
                    <div key={s.source} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: '#333', textTransform: 'capitalize' }}>{s.source}</span>
                      <span style={{ color: '#888' }}>£{s.revenue.toFixed(2)} ({s.count})</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {data.vanBreakdown.length > 1 && (
            <div style={CARD}>
              <div style={LABEL}>Top-performing vans</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {data.vanBreakdown.map((v: any) => (
                  <div key={v.van_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#333', fontWeight: 600 }}>{v.van_name || 'Unnamed Van'}</span>
                    <span style={{ color: '#888' }}>£{v.revenue.toFixed(2)} · {v.orders} orders</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, color: '#bbb', marginTop: -8, marginBottom: 20 }}>
            Revenue = order total, excluding cancelled orders. Figures cover the last {data.windowDays} days except Today/This Week/This Month.
          </div>
        </>
      )}
    </div>
  )
}
