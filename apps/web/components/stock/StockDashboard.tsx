// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'

const CARD = { background: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: 20 }
const LABEL = { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' as const, marginBottom: 8 }
const INPUT = { padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, width: '100%', boxSizing: 'border-box' as const }
const BTN = { padding: '10px 18px', borderRadius: 8, background: '#f97316', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }
const BTN_SECONDARY = { ...BTN, background: '#f5f6fa', color: '#374151', border: '1px solid #e5e7eb' }

const TABS = ['Items', 'Stocktake', 'Wastage', 'Movements'] as const

export function StockDashboard() {
  const [tab, setTab] = useState<typeof TABS[number]>('Items')
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', borderRadius: 20, border: tab === t ? 'none' : '1px solid #e5e7eb', background: tab === t ? '#f97316' : '#fff', color: tab === t ? '#fff' : '#555', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{t}</button>
        ))}
      </div>
      {tab === 'Items' && <ItemsTab />}
      {tab === 'Stocktake' && <StocktakeTab />}
      {tab === 'Wastage' && <WastageTab />}
      {tab === 'Movements' && <MovementsTab />}
    </div>
  )
}

function ItemsTab() {
  const [items, setItems] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<any>({ name: '', category: '', unit: 'each', minimum_quantity: 0 })
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    const q = filter === 'low' ? '?low_stock=1' : filter === 'out' ? '?out_of_stock=1' : ''
    Promise.all([
      fetch(`/api/stock/items${q}`).then(r => r.json()),
      fetch('/api/stock/locations').then(r => r.json()),
    ]).then(([i, l]) => { setItems(Array.isArray(i) ? i : []); setLocations(Array.isArray(l) ? l : []) }).finally(() => setLoading(false))
  }
  useEffect(load, [filter])

  const addItem = async () => {
    if (!form.name) return setError('Name is required')
    setError('')
    const res = await fetch('/api/stock/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    if (!res.ok) return setError(data.error ?? 'Failed to add item')
    setShowAdd(false); setForm({ name: '', category: '', unit: 'each', minimum_quantity: 0 }); load()
  }

  if (locations.length === 0 && !loading) {
    return (
      <div style={{ ...CARD, textAlign: 'center', padding: '32px 20px' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📍</div>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Set up a stock location first</div>
        <p style={{ fontSize: 13, color: '#888', margin: '0 0 14px' }}>Add a warehouse, storage area, or per-van location before adding stock items.</p>
        <LocationCreator onCreated={load} />
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'low', 'out'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 12px', borderRadius: 16, border: filter === f ? 'none' : '1px solid #e5e7eb', background: filter === f ? '#111' : '#fff', color: filter === f ? '#fff' : '#555', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {f === 'all' ? 'All' : f === 'low' ? '⚠ Low stock' : '❌ Out of stock'}
            </button>
          ))}
        </div>
        <button style={BTN} onClick={() => setShowAdd(v => !v)}>{showAdd ? 'Cancel' : '+ Add item'}</button>
      </div>

      {showAdd && (
        <div style={CARD}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <input style={INPUT} placeholder="Name (e.g. Cod)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input style={INPUT} placeholder="Category (e.g. Fish)" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
            <input style={INPUT} placeholder="Unit (e.g. portion, kg)" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
            <input style={INPUT} type="number" placeholder="Minimum quantity" value={form.minimum_quantity} onChange={e => setForm({ ...form, minimum_quantity: Number(e.target.value) })} />
            <input style={INPUT} placeholder="Barcode (optional)" value={form.barcode ?? ''} onChange={e => setForm({ ...form, barcode: e.target.value })} />
            <input style={INPUT} type="number" step="0.01" placeholder="Cost price £ (optional)" value={form.cost_price ?? ''} onChange={e => setForm({ ...form, cost_price: Number(e.target.value) })} />
          </div>
          {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <button style={BTN} onClick={addItem}>Save item</button>
        </div>
      )}

      {loading ? <div style={{ color: '#888', padding: 20 }}>Loading…</div> : items.length === 0 ? (
        <div style={{ ...CARD, textAlign: 'center', color: '#888' }}>No stock items yet{filter !== 'all' ? ' matching this filter' : ''}.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(i => {
            const status = i.current_quantity <= 0 ? 'out' : i.current_quantity <= i.minimum_quantity ? 'low' : 'ok'
            return (
              <div key={i.id} style={{ ...CARD, margin: 0, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{i.name}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{i.category || 'Uncategorised'} · {i.current_quantity} {i.unit}{status === 'low' ? ' — low' : ''}</div>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: status === 'out' ? '#fee2e2' : status === 'low' ? '#fef3c7' : '#d1fae5', color: status === 'out' ? '#991b1b' : status === 'low' ? '#92400e' : '#065f46' }}>
                  {status === 'out' ? 'OUT OF STOCK' : status === 'low' ? 'LOW STOCK' : 'OK'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LocationCreator({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const create = async () => {
    if (!name) return
    setSaving(true)
    await fetch('/api/stock/locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, type: 'warehouse' }) })
    setSaving(false); setName(''); onCreated()
  }
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      <input style={{ ...INPUT, width: 200 }} placeholder="e.g. Main Storage" value={name} onChange={e => setName(e.target.value)} />
      <button style={BTN} onClick={create} disabled={saving}>{saving ? 'Adding…' : 'Add location'}</button>
    </div>
  )
}

function StocktakeTab() {
  const [locations, setLocations] = useState<any[]>([])
  const [locationId, setLocationId] = useState('')
  const [active, setActive] = useState<any>(null)
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [result, setResult] = useState<any>(null)

  useEffect(() => { fetch('/api/stock/locations').then(r => r.json()).then(d => setLocations(Array.isArray(d) ? d : [])) }, [])

  const start = async () => {
    if (!locationId) return
    const res = await fetch('/api/stock/stocktakes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location_id: locationId }) })
    const data = await res.json()
    const full = await fetch(`/api/stock/stocktakes/${data.id}`).then(r => r.json())
    setActive(full); setCounts({}); setResult(null)
  }

  const confirm = async () => {
    const payload = {
      confirm: true,
      counts: Object.entries(counts).filter(([, v]) => v !== '').map(([stock_item_id, v]) => ({ stock_item_id, counted_quantity: Number(v) })),
    }
    const res = await fetch(`/api/stock/stocktakes/${active.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    setResult(data); setActive(null)
  }

  if (result) {
    return (
      <div style={CARD}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>✅ Stocktake confirmed</div>
        {result.differences?.length === 0 ? <div style={{ color: '#888', fontSize: 13 }}>No differences from expected quantities.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.differences?.map((d: any, i: number) => (
              <div key={i} style={{ fontSize: 13 }}>Adjusted by {d.delta > 0 ? '+' : ''}{d.delta}</div>
            ))}
          </div>
        )}
        <button style={{ ...BTN_SECONDARY, marginTop: 12 }} onClick={() => setResult(null)}>Start another stocktake</button>
      </div>
    )
  }

  if (!active) {
    return (
      <div style={CARD}>
        <div style={LABEL}>Start a stocktake</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select style={{ ...INPUT, width: 220 }} value={locationId} onChange={e => setLocationId(e.target.value)}>
            <option value="">Select location…</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <button style={BTN} onClick={start} disabled={!locationId}>Start</button>
        </div>
      </div>
    )
  }

  return (
    <div style={CARD}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{active.stock_locations?.name}</div>
      <p style={{ fontSize: 12, color: '#888', margin: '0 0 14px' }}>Enter the actual counted quantity for each item. Leave blank to skip.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(active.items ?? []).map((it: any) => (
          <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{it.stock_items?.name}</div>
              <div style={{ fontSize: 11, color: '#888' }}>Expected: {it.expected_quantity} {it.stock_items?.unit}</div>
            </div>
            <input style={{ ...INPUT, width: 90 }} type="number" placeholder={String(it.expected_quantity)} value={counts[it.stock_item_id] ?? ''} onChange={e => setCounts({ ...counts, [it.stock_item_id]: e.target.value })} />
          </div>
        ))}
        {(active.items ?? []).length === 0 && <div style={{ color: '#888', fontSize: 13 }}>Nothing stocked at this location yet.</div>}
      </div>
      <button style={{ ...BTN, marginTop: 16 }} onClick={confirm}>Confirm stocktake</button>
    </div>
  )
}

function WastageTab() {
  const [data, setData] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [form, setForm] = useState<any>({ stock_item_id: '', location_id: '', quantity: '', reason: 'Damaged' })
  const [error, setError] = useState('')

  const load = () => {
    fetch('/api/wastage').then(r => r.json()).then(setData)
    fetch('/api/stock/items').then(r => r.json()).then(d => setItems(Array.isArray(d) ? d : []))
    fetch('/api/stock/locations').then(r => r.json()).then(d => setLocations(Array.isArray(d) ? d : []))
  }
  useEffect(load, [])

  const submit = async () => {
    if (!form.stock_item_id || !form.location_id || !form.quantity) return setError('Item, location and quantity are required')
    setError('')
    const res = await fetch('/api/wastage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, quantity: Number(form.quantity) }) })
    const d = await res.json()
    if (!res.ok) return setError(d.error ?? 'Failed to record wastage')
    setForm({ stock_item_id: '', location_id: '', quantity: '', reason: 'Damaged' }); load()
  }

  const REASONS = ['Damaged', 'Dropped', 'Overcooked', 'Expired', 'Incorrect order', 'Spoiled', 'Packaging damaged', 'Other']

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['Today', data?.today], ['This week', data?.week], ['This month', data?.month]].map(([label, val]: any) => (
          <div key={label} style={{ flex: 1, minWidth: 120, background: '#f9fafb', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>£{(val ?? 0).toFixed(2)}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={CARD}>
        <div style={LABEL}>Record wastage</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <select style={INPUT} value={form.stock_item_id} onChange={e => setForm({ ...form, stock_item_id: e.target.value })}>
            <option value="">Stock item…</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <select style={INPUT} value={form.location_id} onChange={e => setForm({ ...form, location_id: e.target.value })}>
            <option value="">Location…</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <input style={INPUT} type="number" placeholder="Quantity" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
          <select style={INPUT} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}>
            {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{error}</div>}
        <button style={BTN} onClick={submit}>Record wastage</button>
      </div>

      <div style={CARD}>
        <div style={LABEL}>Recent wastage</div>
        {(data?.records ?? []).length === 0 ? <div style={{ color: '#888', fontSize: 13 }}>None recorded yet.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.records.slice(0, 20).map((r: any) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span>{r.stock_items?.name} — {r.quantity} {r.stock_items?.unit} ({r.reason})</span>
                <span style={{ color: '#888' }}>{r.cost ? `£${r.cost.toFixed(2)}` : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MovementsTab() {
  const [movements, setMovements] = useState<any[]>([])
  useEffect(() => { fetch('/api/stock/movements').then(r => r.json()).then(d => setMovements(Array.isArray(d) ? d : [])) }, [])
  return (
    <div style={CARD}>
      <div style={LABEL}>Movement history</div>
      {movements.length === 0 ? <div style={{ color: '#888', fontSize: 13 }}>No movements yet.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {movements.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
              <div>
                <span style={{ fontWeight: 600 }}>{m.stock_items?.name}</span>
                <span style={{ color: '#888' }}> · {m.stock_locations?.name} · {m.movement_type}</span>
              </div>
              <span style={{ fontWeight: 700, color: m.quantity < 0 ? '#dc2626' : '#059669' }}>{m.quantity > 0 ? '+' : ''}{m.quantity}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
