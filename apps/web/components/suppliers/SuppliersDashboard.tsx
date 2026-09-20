// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'

const CARD = { background: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: 20 }
const LABEL = { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' as const, marginBottom: 8 }
const INPUT = { padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, width: '100%', boxSizing: 'border-box' as const }
const BTN = { padding: '10px 18px', borderRadius: 8, background: '#f97316', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }

export function SuppliersDashboard() {
  const [tab, setTab] = useState<'Suppliers' | 'Purchase Orders'>('Suppliers')
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {(['Suppliers', 'Purchase Orders'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', borderRadius: 20, border: tab === t ? 'none' : '1px solid #e5e7eb', background: tab === t ? '#f97316' : '#fff', color: tab === t ? '#fff' : '#555', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{t}</button>
        ))}
      </div>
      {tab === 'Suppliers' ? <SuppliersTab /> : <PurchaseOrdersTab />}
    </div>
  )
}

function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<any>({ supplier_name: '' })
  const [error, setError] = useState('')

  const load = () => fetch('/api/suppliers').then(r => r.json()).then(d => setSuppliers(Array.isArray(d) ? d : []))
  useEffect(load, [])

  const submit = async () => {
    if (!form.supplier_name) return setError('Supplier name required')
    setError('')
    const res = await fetch('/api/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await res.json()
    if (!res.ok) return setError(d.error ?? 'Failed to add supplier')
    setShowAdd(false); setForm({ supplier_name: '' }); load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button style={BTN} onClick={() => setShowAdd(v => !v)}>{showAdd ? 'Cancel' : '+ Add supplier'}</button>
      </div>
      {showAdd && (
        <div style={CARD}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <input style={INPUT} placeholder="Supplier name" value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} />
            <input style={INPUT} placeholder="Contact name" value={form.contact_name ?? ''} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
            <input style={INPUT} placeholder="Phone" value={form.phone ?? ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <input style={INPUT} placeholder="Email" value={form.email ?? ''} onChange={e => setForm({ ...form, email: e.target.value })} />
            <input style={INPUT} placeholder="Website" value={form.website ?? ''} onChange={e => setForm({ ...form, website: e.target.value })} />
            <input style={INPUT} placeholder="Account reference" value={form.account_reference ?? ''} onChange={e => setForm({ ...form, account_reference: e.target.value })} />
          </div>
          {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <button style={BTN} onClick={submit}>Save supplier</button>
        </div>
      )}
      {suppliers.length === 0 ? <div style={{ ...CARD, textAlign: 'center', color: '#888' }}>No suppliers yet.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {suppliers.map(s => (
            <div key={s.id} style={{ ...CARD, margin: 0, padding: '14px 16px' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{s.supplier_name}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{[s.contact_name, s.phone, s.email].filter(Boolean).join(' · ') || 'No contact details'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PurchaseOrdersTab() {
  const [pos, setPos] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [lines, setLines] = useState<any[]>([{ stock_item_id: '', quantity_ordered: '', unit_cost: '' }])
  const [error, setError] = useState('')
  const [receiving, setReceiving] = useState<any>(null)

  const load = () => {
    fetch('/api/purchase-orders').then(r => r.json()).then(d => setPos(Array.isArray(d) ? d : []))
    fetch('/api/suppliers').then(r => r.json()).then(d => setSuppliers(Array.isArray(d) ? d : []))
    fetch('/api/stock/items').then(r => r.json()).then(d => setItems(Array.isArray(d) ? d : []))
  }
  useEffect(load, [])

  const submit = async () => {
    const validLines = lines.filter(l => l.stock_item_id && l.quantity_ordered)
    if (!supplierId || !validLines.length) return setError('Supplier and at least one line item are required')
    setError('')
    const res = await fetch('/api/purchase-orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplier_id: supplierId, items: validLines.map(l => ({ stock_item_id: l.stock_item_id, quantity_ordered: Number(l.quantity_ordered), unit_cost: l.unit_cost ? Number(l.unit_cost) : null })) }),
    })
    const d = await res.json()
    if (!res.ok) return setError(d.error ?? 'Failed to create purchase order')
    setShowAdd(false); setSupplierId(''); setLines([{ stock_item_id: '', quantity_ordered: '', unit_cost: '' }]); load()
  }

  const setStatus = async (id: string, status: string) => {
    await fetch(`/api/purchase-orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    load()
  }

  const openReceive = async (id: string) => {
    const po = await fetch(`/api/purchase-orders/${id}`).then(r => r.json())
    const locations = await fetch('/api/stock/locations').then(r => r.json())
    setReceiving({ po, locations: Array.isArray(locations) ? locations : [], locationId: '', counts: {} })
  }

  const confirmReceive = async () => {
    if (!receiving.locationId) return
    const items = Object.entries(receiving.counts).filter(([, v]: any) => Number(v) > 0).map(([id, v]: any) => ({ purchase_order_item_id: id, quantity_received_now: Number(v) }))
    if (!items.length) return
    await fetch(`/api/purchase-orders/${receiving.po.id}/receive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location_id: receiving.locationId, items }) })
    setReceiving(null); load()
  }

  const STATUS_COLOR: Record<string, string> = { DRAFT: '#6b7280', ORDERED: '#3b82f6', PARTIALLY_RECEIVED: '#f59e0b', RECEIVED: '#059669', CANCELLED: '#dc2626' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button style={BTN} onClick={() => setShowAdd(v => !v)}>{showAdd ? 'Cancel' : '+ New purchase order'}</button>
      </div>

      {showAdd && (
        <div style={CARD}>
          <select style={{ ...INPUT, marginBottom: 10 }} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
            <option value="">Select supplier…</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
          </select>
          {lines.map((line, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <select style={INPUT} value={line.stock_item_id} onChange={e => { const l = [...lines]; l[i].stock_item_id = e.target.value; setLines(l) }}>
                <option value="">Item…</option>
                {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
              </select>
              <input style={INPUT} type="number" placeholder="Qty" value={line.quantity_ordered} onChange={e => { const l = [...lines]; l[i].quantity_ordered = e.target.value; setLines(l) }} />
              <input style={INPUT} type="number" step="0.01" placeholder="Unit cost £" value={line.unit_cost} onChange={e => { const l = [...lines]; l[i].unit_cost = e.target.value; setLines(l) }} />
            </div>
          ))}
          <button style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 10 }} onClick={() => setLines([...lines, { stock_item_id: '', quantity_ordered: '', unit_cost: '' }])}>+ Add another line</button>
          {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <div><button style={BTN} onClick={submit}>Save purchase order</button></div>
        </div>
      )}

      {receiving && (
        <div style={CARD}>
          <div style={LABEL}>Receive delivery — {receiving.po.supplier_records?.supplier_name}</div>
          <select style={{ ...INPUT, marginBottom: 10 }} value={receiving.locationId} onChange={e => setReceiving({ ...receiving, locationId: e.target.value })}>
            <option value="">Receiving location…</option>
            {receiving.locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          {(receiving.po.items ?? []).map((it: any) => (
            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 13 }}>{it.stock_items?.name} — ordered {it.quantity_ordered}, received {it.quantity_received}</div>
              <input style={{ ...INPUT, width: 80 }} type="number" placeholder="0" onChange={e => setReceiving({ ...receiving, counts: { ...receiving.counts, [it.id]: e.target.value } })} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={BTN} onClick={confirmReceive}>Confirm receipt</button>
            <button style={{ ...BTN, background: '#f5f6fa', color: '#374151' }} onClick={() => setReceiving(null)}>Cancel</button>
          </div>
        </div>
      )}

      {pos.length === 0 ? <div style={{ ...CARD, textAlign: 'center', color: '#888' }}>No purchase orders yet.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pos.map(po => {
            const total = (po.purchase_order_items ?? []).length
            const received = (po.purchase_order_items ?? []).filter((i: any) => i.quantity_received >= i.quantity_ordered).length
            return (
              <div key={po.id} style={{ ...CARD, margin: 0, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{po.supplier_records?.supplier_name}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{total} item{total === 1 ? '' : 's'} · {received}/{total} lines fully received</div>
                  </div>
                  <span style={{ padding: '4px 12px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#f3f4f6', color: STATUS_COLOR[po.status] }}>{po.status}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {po.status === 'DRAFT' && <button style={{ ...BTN, padding: '6px 14px' }} onClick={() => setStatus(po.id, 'ORDERED')}>Mark ordered</button>}
                  {(po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED') && <button style={{ ...BTN, padding: '6px 14px' }} onClick={() => openReceive(po.id)}>Receive delivery</button>}
                  {(po.status === 'DRAFT' || po.status === 'ORDERED') && <button style={{ padding: '6px 14px', borderRadius: 8, background: '#fee2e2', color: '#991b1b', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }} onClick={() => setStatus(po.id, 'CANCELLED')}>Cancel</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
