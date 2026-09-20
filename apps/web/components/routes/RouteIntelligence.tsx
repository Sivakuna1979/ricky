// @ts-nocheck
'use client'
// Route Intelligence dashboard UI (G12–G20 performance, G8–G10 sessions,
// G21–G26 demand & loading). Every number shown here comes from the same
// lib/routes/analytics.ts / lib/routes/demand.ts functions the FoodTaxi AI
// route tools use — dashboard and AI can never disagree.
import { useEffect, useState } from 'react'

const TABS = [
  { key: 'sessions', label: 'Sessions' },
  { key: 'performance', label: 'Performance' },
  { key: 'demand', label: 'Demand & Loading' },
]

const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 14 }
const label = { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }
const kpiValue = { fontSize: 22, fontWeight: 800, color: '#111' }
const input = { padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }
const btn = { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }
const btnSecondary = { ...btn, background: '#f5f6fa', color: '#374151', border: '1px solid #e5e7eb' }

function todayIso() { return new Date().toISOString().slice(0, 10) }
function scheduleDow(dateStr: string) { return (new Date(`${dateStr}T00:00:00Z`).getUTCDay() + 6) % 7 }

export function RouteIntelligence({ vans }: { vans: { id: string; name: string }[] }) {
  const [tab, setTab] = useState('sessions')
  const [vanId, setVanId] = useState(vans[0]?.id ?? '')

  if (!vans.length) {
    return <div style={card}>No vans are assigned to this account yet. Add a van under My Vans to use Route Intelligence.</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={label}>Van</div>
          <select value={vanId} onChange={e => setVanId(e.target.value)} style={input}>
            {vans.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: tab === t.key ? '#fff7ed' : '#fff', color: tab === t.key ? '#f97316' : '#555', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{t.label}</button>
          ))}
        </div>
      </div>

      {tab === 'sessions' && <SessionsTab vanId={vanId} />}
      {tab === 'performance' && <PerformanceTab vanId={vanId} />}
      {tab === 'demand' && <DemandTab vanId={vanId} />}
    </div>
  )
}

function SessionsTab({ vanId }: { vanId: string }) {
  const [date, setDate] = useState(todayIso())
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/routes/sessions?van_id=${vanId}&date=${date}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSession(data)
    } catch (e: any) {
      setError(e.message ?? 'Could not load session.')
    }
    setLoading(false)
  }
  useEffect(() => { if (vanId) load() }, [vanId, date])

  const startSession = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/routes/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ van_id: vanId, date }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSession(data)
    } catch (e: any) {
      setError(e.message ?? 'Could not start session.')
    }
    setLoading(false)
  }

  const endSession = async () => {
    await fetch(`/api/routes/sessions/${session.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completed' }) })
    load()
  }

  const markStop = async (stopId: string, status: string) => {
    await fetch(`/api/routes/sessions/${session.id}/stops/${stopId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    load()
  }

  const saveNote = async (stopId: string) => {
    const notes = notesDraft[stopId]?.trim()
    if (!notes) return
    await fetch(`/api/routes/sessions/${session.id}/stops/${stopId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes }) })
    setNotesDraft(d => ({ ...d, [stopId]: '' }))
    load()
  }

  return (
    <div>
      <div style={card}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={label}>Service date</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={input} />
          </div>
          {!session && !loading && <button onClick={startSession} style={btn}>Start route session</button>}
          {session?.status === 'active' && <button onClick={endSession} style={btnSecondary}>End route session</button>}
          {session && <span style={{ fontSize: 12, fontWeight: 700, color: session.status === 'active' ? '#059669' : '#888', marginLeft: 'auto' }}>{session.status === 'active' ? '● Active' : session.status === 'completed' ? 'Completed' : session.status}</span>}
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{error}</div>}
        {!session && !loading && !error && <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>No session started for this date yet. Starting one snapshots today's schedule as a checklist — this is optional and never required for POS/orders to work.</div>}
      </div>

      {session && (session.stops ?? []).map((s: any) => (
        <div key={s.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{s.location_name}</div>
              <div style={{ fontSize: 11, color: '#888' }}>
                Scheduled {s.scheduled_arrival ?? '—'}–{s.scheduled_departure ?? '—'}
                {s.actual_arrival_at && ` · Arrived ${new Date(s.actual_arrival_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                {s.actual_departure_at && ` · Departed ${new Date(s.actual_departure_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: s.status === 'departed' ? '#ecfdf5' : s.status === 'arrived' ? '#fff7ed' : s.status === 'skipped' ? '#f3f4f6' : '#f5f6fa', color: s.status === 'departed' ? '#059669' : s.status === 'arrived' ? '#f97316' : '#888' }}>{s.status}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {s.status === 'pending' && <button onClick={() => markStop(s.id, 'arrived')} style={{ ...btn, padding: '6px 12px', fontSize: 12 }}>Mark arrived</button>}
            {s.status === 'arrived' && <button onClick={() => markStop(s.id, 'departed')} style={{ ...btn, padding: '6px 12px', fontSize: 12 }}>Mark departed</button>}
            {s.status !== 'skipped' && s.status !== 'departed' && <button onClick={() => markStop(s.id, 'skipped')} style={{ ...btnSecondary, padding: '6px 12px', fontSize: 12 }}>Skip</button>}
          </div>
          {s.notes && <div style={{ fontSize: 12, color: '#555', marginTop: 8, background: '#f9fafb', borderRadius: 8, padding: 8 }}>📝 {s.notes}</div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input placeholder="Add a note (e.g. road closed, quiet night)…" value={notesDraft[s.id] ?? ''} onChange={e => setNotesDraft(d => ({ ...d, [s.id]: e.target.value }))} style={{ ...input, flex: 1 }} />
            <button onClick={() => saveNote(s.id)} style={{ ...btnSecondary, fontSize: 12 }}>Save note</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function PerformanceTab({ vanId }: { vanId: string }) {
  const [start, setStart] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
  const [end, setEnd] = useState(todayIso())
  const [perf, setPerf] = useState<any>(null)
  const [dayPerf, setDayPerf] = useState<any>(null)
  const [anomalyDate, setAnomalyDate] = useState(new Date(Date.now() - 86400000).toISOString().slice(0, 10))
  const [anomaly, setAnomaly] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const [r1, r2] = await Promise.all([
      fetch(`/api/routes/analytics?type=route&van_id=${vanId}&start=${start}&end=${end}`).then(r => r.json()),
      fetch(`/api/routes/analytics?type=day-of-week&van_id=${vanId}`).then(r => r.json()),
    ])
    setPerf(r1); setDayPerf(r2)
    setLoading(false)
  }
  useEffect(() => { if (vanId) load() }, [vanId, start, end])

  const loadAnomaly = async () => {
    const data = await fetch(`/api/routes/analytics?type=anomalies&van_id=${vanId}&date=${anomalyDate}`).then(r => r.json())
    setAnomaly(data)
  }

  return (
    <div>
      <div style={card}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div><div style={label}>From</div><input type="date" value={start} onChange={e => setStart(e.target.value)} style={input} /></div>
          <div><div style={label}>To</div><input type="date" value={end} onChange={e => setEnd(e.target.value)} style={input} /></div>
        </div>
      </div>

      {loading && <div style={{ fontSize: 13, color: '#888' }}>Loading…</div>}

      {perf && (
        <div style={card}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div><div style={label}>Revenue</div><div style={kpiValue}>£{perf.revenue?.toFixed(2)}</div></div>
            <div><div style={label}>Orders</div><div style={kpiValue}>{perf.orders}</div></div>
            <div><div style={label}>Avg order value</div><div style={kpiValue}>£{perf.average_order_value?.toFixed(2)}</div></div>
          </div>
        </div>
      )}

      {dayPerf && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Average by day of week <span style={{ fontWeight: 400, color: '#888' }}>(last {dayPerf.period_weeks} weeks)</span></div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ textAlign: 'left', color: '#888' }}><th style={{ padding: '4px 0' }}>Day</th><th>Sample</th><th>Avg revenue</th><th>Avg orders</th><th>Avg AOV</th></tr></thead>
            <tbody>
              {dayPerf.days.map((d: any) => (
                <tr key={d.day} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 0', fontWeight: 600 }}>{d.day}</td>
                  <td>{d.trading_days_sampled} day{d.trading_days_sampled === 1 ? '' : 's'}</td>
                  <td>{d.average_revenue !== null ? `£${d.average_revenue.toFixed(2)}` : '—'}</td>
                  <td>{d.average_orders ?? '—'}</td>
                  <td>{d.average_order_value !== null ? `£${d.average_order_value.toFixed(2)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Was a day unusual?</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={anomalyDate} onChange={e => setAnomalyDate(e.target.value)} style={input} />
          <button onClick={loadAnomaly} style={btnSecondary}>Check</button>
        </div>
        {anomaly && (
          <div style={{ marginTop: 10, fontSize: 13 }}>
            {!anomaly.has_data && <div style={{ color: '#888' }}>{anomaly.message}</div>}
            {anomaly.has_data && anomaly.comparable_days < 3 && <div style={{ color: '#888' }}>{anomaly.message}</div>}
            {anomaly.has_data && anomaly.comparable_days >= 3 && (
              <div>
                Revenue was <strong>£{anomaly.revenue.toFixed(2)}</strong> vs an average of <strong>£{anomaly.average_revenue_same_weekday.toFixed(2)}</strong> on the last {anomaly.comparable_days} comparable days ({anomaly.revenue_percent_difference > 0 ? '+' : ''}{anomaly.revenue_percent_difference}%).
                {anomaly.is_notable && <span style={{ color: '#f97316', fontWeight: 700 }}> This is a notable difference (≥20%) — measured only, no cause is implied.</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function DemandTab({ vanId }: { vanId: string }) {
  const [date, setDate] = useState(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10))
  const [stops, setStops] = useState<any[]>([])
  const [stopId, setStopId] = useState('')
  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [proposing, setProposing] = useState(false)
  const [proposed, setProposed] = useState<any>(null)

  useEffect(() => {
    if (!vanId || !date) return
    const dow = scheduleDow(date)
    fetch(`/api/schedule/stops?van_id=${vanId}&day_of_week=${dow}`).then(r => r.json()).then(d => {
      setStops(d.stops ?? [])
      setStopId(d.stops?.[0]?.id ?? '')
    })
  }, [vanId, date])

  const loadPlan = async () => {
    if (!stopId) return
    setLoading(true); setError(''); setPlan(null); setProposed(null)
    try {
      const res = await fetch(`/api/routes/demand?van_id=${vanId}&stop_id=${stopId}&date=${date}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPlan(data)
    } catch (e: any) {
      setError(e.message ?? 'Could not load loading plan.')
    }
    setLoading(false)
  }

  const proposeTransfer = async () => {
    const shortfalls = (plan.items ?? []).filter((i: any) => i.shortfall && i.shortfall > 0)
    if (!shortfalls.length) return
    setProposing(true)
    try {
      const locations = await fetch('/api/stock/locations').then(r => r.json())
      const warehouse = (Array.isArray(locations) ? locations : []).find((l: any) => l.type === 'warehouse')
      if (!warehouse) throw new Error('No warehouse location is set up to transfer from yet (Stock → Locations).')

      const res = await fetch('/api/routes/demand/propose-transfer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          van_id: vanId,
          from_location_id: warehouse.id,
          items: shortfalls.map((i: any) => ({ stock_item_id: i.stock_item_id, quantity: i.shortfall })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setProposed(data)
    } catch (e: any) {
      setError(e.message ?? 'Could not propose a transfer.')
    }
    setProposing(false)
  }

  const confirmProposed = async () => {
    const res = await fetch(`/api/ai/actions/${proposed.pending_action_id}/confirm`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) setProposed((p: any) => ({ ...p, confirmed: true }))
    else setError(data.error)
  }

  return (
    <div>
      <div style={card}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div><div style={label}>Target date</div><input type="date" value={date} onChange={e => setDate(e.target.value)} style={input} /></div>
          <div>
            <div style={label}>Stop</div>
            <select value={stopId} onChange={e => setStopId(e.target.value)} style={input}>
              {stops.length === 0 && <option value="">No stop scheduled that day</option>}
              {stops.map((s: any) => <option key={s.id} value={s.id}>{s.location_name}</option>)}
            </select>
          </div>
          <button onClick={loadPlan} disabled={!stopId} style={{ ...btn, opacity: stopId ? 1 : 0.5 }}>Get loading plan</button>
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{error}</div>}
      </div>

      {loading && <div style={{ fontSize: 13, color: '#888' }}>Calculating…</div>}

      {plan && plan.message && !plan.items?.length && <div style={card}>{plan.message}</div>}

      {plan?.items?.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Suggested loading plan</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ textAlign: 'left', color: '#888' }}><th style={{ padding: '4px 0' }}>Item</th><th>Suggested</th><th>On van</th><th>Warehouse</th><th>Shortfall</th></tr></thead>
            <tbody>
              {plan.items.map((i: any) => (
                <tr key={i.stock_item_id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 0', fontWeight: 600 }}>{i.item_name}</td>
                  <td>{i.suggested_quantity !== null ? `${i.suggested_quantity} ${i.unit ?? ''}` : '—'}</td>
                  <td>{i.currently_on_van} {i.unit}</td>
                  <td>{i.currently_in_warehouse} {i.unit}</td>
                  <td style={{ color: i.shortfall > 0 ? '#dc2626' : '#059669', fontWeight: 700 }}>{i.shortfall !== null ? `${i.shortfall} ${i.unit ?? ''}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {plan.items.some((i: any) => i.cold_start || i.message) && (
            <div style={{ marginTop: 10, fontSize: 11, color: '#888' }}>
              {plan.items.filter((i: any) => i.message).map((i: any) => <div key={i.stock_item_id}>• {i.item_name}: {i.message}</div>)}
            </div>
          )}
          {plan.items.some((i: any) => i.sample_size > 0) && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#888' }}>Based on the average of up to the last 6 comparable {new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })}s at this stop, plus a buffer.</div>
          )}
          {plan.items.some((i: any) => i.shortfall > 0) && !proposed && (
            <button onClick={proposeTransfer} disabled={proposing} style={{ ...btn, marginTop: 12 }}>{proposing ? 'Preparing…' : 'Propose stock transfer for shortfalls'}</button>
          )}
          {proposed && !proposed.confirmed && (
            <div style={{ marginTop: 12, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Draft transfer ready — nothing has moved yet.</div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>{proposed.items.map((i: any) => `${i.quantity} × ${i.name}`).join(', ')}</div>
              <button onClick={confirmProposed} style={{ ...btn, padding: '6px 14px', fontSize: 12 }}>Confirm transfer</button>
            </div>
          )}
          {proposed?.confirmed && <div style={{ marginTop: 12, color: '#059669', fontWeight: 700, fontSize: 13 }}>✅ Transfer created.</div>}
        </div>
      )}
    </div>
  )
}
