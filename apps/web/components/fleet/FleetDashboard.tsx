// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'

const CARD = { background: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: 20 }
const LABEL = { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' as const, marginBottom: 8 }
const INPUT = { padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, width: '100%', boxSizing: 'border-box' as const }
const BTN = { padding: '10px 18px', borderRadius: 8, background: '#f97316', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }

function daysUntil(date: string | null) {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
}
function AlertBadge({ label, date }: { label: string; date: string | null }) {
  const days = daysUntil(date)
  if (days === null) return null
  const urgent = days <= 14
  const soon = days <= 30
  if (!soon) return null
  return (
    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: days < 0 ? '#fee2e2' : urgent ? '#fee2e2' : '#fef3c7', color: days < 0 ? '#991b1b' : urgent ? '#991b1b' : '#92400e', marginRight: 6 }}>
      {label} {days < 0 ? 'overdue' : `in ${days}d`}
    </span>
  )
}

export function FleetDashboard() {
  const [tab, setTab] = useState<'Vehicles' | 'Equipment'>('Vehicles')
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {(['Vehicles', 'Equipment'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', borderRadius: 20, border: tab === t ? 'none' : '1px solid #e5e7eb', background: tab === t ? '#f97316' : '#fff', color: tab === t ? '#fff' : '#555', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{t}</button>
        ))}
      </div>
      {tab === 'Vehicles' ? <VehiclesTab /> : <EquipmentTab />}
    </div>
  )
}

function VehiclesTab() {
  const [vans, setVans] = useState<any[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = () => fetch('/api/vehicles').then(r => r.json()).then(d => setVans(Array.isArray(d) ? d : []))
  useEffect(load, [])

  return (
    <div>
      {vans.length === 0 ? <div style={{ ...CARD, textAlign: 'center', color: '#888' }}>No vans yet — add one under My Vans first.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {vans.map((v: any) => {
            const details = v.vehicle_details?.[0] ?? {}
            return (
              <div key={v.id} style={{ ...CARD, margin: 0, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap', gap: 8 }} onClick={() => setExpanded(expanded === v.id ? null : v.id)}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{v.name} {v.registration_plate ? `· ${v.registration_plate}` : ''}</div>
                    <div style={{ marginTop: 4 }}>
                      <AlertBadge label="MOT" date={details.mot_expiry} />
                      <AlertBadge label="Insurance" date={details.insurance_expiry} />
                      <AlertBadge label="Tax" date={details.tax_expiry} />
                      <AlertBadge label="Service" date={details.service_due_date} />
                    </div>
                  </div>
                  <span style={{ color: '#6366f1', fontSize: 12, fontWeight: 600 }}>{expanded === v.id ? 'Close ▲' : 'Details ▼'}</span>
                </div>
                {expanded === v.id && <VehicleDetail vanId={v.id} initial={details} onSaved={load} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function VehicleDetail({ vanId, initial, onSaved }: { vanId: string; initial: any; onSaved: () => void }) {
  const [form, setForm] = useState<any>({
    make: initial.make ?? '', model: initial.model ?? '', year: initial.year ?? '', fuel_type: initial.fuel_type ?? '',
    mileage: initial.mileage ?? '', mot_expiry: initial.mot_expiry ?? '', insurance_expiry: initial.insurance_expiry ?? '',
    tax_expiry: initial.tax_expiry ?? '', service_due_date: initial.service_due_date ?? '', notes: initial.notes ?? '',
  })
  const [maintenance, setMaintenance] = useState<any[]>([])
  const [showMaint, setShowMaint] = useState(false)
  const [mForm, setMForm] = useState<any>({ maintenance_date: new Date().toISOString().slice(0, 10), maintenance_type: 'SERVICE', description: '', cost: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetch(`/api/vehicles/${vanId}/maintenance`).then(r => r.json()).then(d => setMaintenance(Array.isArray(d) ? d : [])) }, [vanId])

  const save = async () => {
    setSaving(true)
    await fetch(`/api/vehicles/${vanId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false); onSaved()
  }

  const addMaintenance = async () => {
    const res = await fetch(`/api/vehicles/${vanId}/maintenance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mForm) })
    if (res.ok) {
      setMaintenance([await res.json(), ...maintenance])
      setMForm({ maintenance_date: new Date().toISOString().slice(0, 10), maintenance_type: 'SERVICE', description: '', cost: '' })
      onSaved()
    }
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <input style={INPUT} placeholder="Make" value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} />
        <input style={INPUT} placeholder="Model" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
        <input style={INPUT} type="number" placeholder="Year" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} />
        <input style={INPUT} placeholder="Fuel type" value={form.fuel_type} onChange={e => setForm({ ...form, fuel_type: e.target.value })} />
        <input style={INPUT} type="number" placeholder="Mileage" value={form.mileage} onChange={e => setForm({ ...form, mileage: e.target.value })} />
        <div />
        <label style={{ fontSize: 11, color: '#888' }}>MOT expiry<input style={INPUT} type="date" value={form.mot_expiry ?? ''} onChange={e => setForm({ ...form, mot_expiry: e.target.value })} /></label>
        <label style={{ fontSize: 11, color: '#888' }}>Insurance expiry<input style={INPUT} type="date" value={form.insurance_expiry ?? ''} onChange={e => setForm({ ...form, insurance_expiry: e.target.value })} /></label>
        <label style={{ fontSize: 11, color: '#888' }}>Road tax expiry<input style={INPUT} type="date" value={form.tax_expiry ?? ''} onChange={e => setForm({ ...form, tax_expiry: e.target.value })} /></label>
        <label style={{ fontSize: 11, color: '#888' }}>Service due<input style={INPUT} type="date" value={form.service_due_date ?? ''} onChange={e => setForm({ ...form, service_due_date: e.target.value })} /></label>
      </div>
      <button style={BTN} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save vehicle details'}</button>

      <div style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={LABEL}>Maintenance history</div>
          <button style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} onClick={() => setShowMaint(v => !v)}>{showMaint ? 'Cancel' : '+ Log maintenance'}</button>
        </div>
        {showMaint && (
          <div style={{ background: '#f9fafb', borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <input style={INPUT} type="date" value={mForm.maintenance_date} onChange={e => setMForm({ ...mForm, maintenance_date: e.target.value })} />
              <select style={INPUT} value={mForm.maintenance_type} onChange={e => setMForm({ ...mForm, maintenance_type: e.target.value })}>
                {['SERVICE', 'REPAIR', 'MOT', 'TYRES', 'BRAKES', 'ELECTRICAL', 'OTHER'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input style={INPUT} placeholder="Description" value={mForm.description} onChange={e => setMForm({ ...mForm, description: e.target.value })} />
              <input style={INPUT} type="number" step="0.01" placeholder="Cost £" value={mForm.cost} onChange={e => setMForm({ ...mForm, cost: e.target.value })} />
            </div>
            <button style={{ ...BTN, padding: '8px 16px' }} onClick={addMaintenance}>Save</button>
          </div>
        )}
        {maintenance.length === 0 ? <div style={{ color: '#888', fontSize: 12 }}>No maintenance logged yet.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {maintenance.map((m: any) => (
              <div key={m.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                {m.maintenance_date} · {m.maintenance_type} · {m.description || '—'} {m.cost ? `· £${m.cost.toFixed(2)}` : ''}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EquipmentTab() {
  const [equipment, setEquipment] = useState<any[]>([])
  const [vans, setVans] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<any>({ name: '', type: '', van_id: '' })

  const load = () => {
    fetch('/api/equipment').then(r => r.json()).then(d => setEquipment(Array.isArray(d) ? d : []))
    fetch('/api/vans').then(r => r.json()).then(d => setVans(Array.isArray(d) ? d : []))
  }
  useEffect(load, [])

  const submit = async () => {
    if (!form.name) return
    await fetch('/api/equipment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setShowAdd(false); setForm({ name: '', type: '', van_id: '' }); load()
  }

  const STATUS_COLOR: Record<string, string> = { active: '#059669', needs_service: '#f59e0b', out_of_service: '#dc2626', retired: '#6b7280' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button style={BTN} onClick={() => setShowAdd(v => !v)}>{showAdd ? 'Cancel' : '+ Add equipment'}</button>
      </div>
      {showAdd && (
        <div style={CARD}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <input style={INPUT} placeholder="Name (e.g. Fryer)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input style={INPUT} placeholder="Type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} />
            <select style={INPUT} value={form.van_id} onChange={e => setForm({ ...form, van_id: e.target.value })}>
              <option value="">Not assigned to a van</option>
              {vans.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <button style={BTN} onClick={submit}>Save equipment</button>
        </div>
      )}
      {equipment.length === 0 ? <div style={{ ...CARD, textAlign: 'center', color: '#888' }}>No equipment recorded yet.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {equipment.map((e: any) => (
            <div key={e.id} style={{ ...CARD, margin: 0, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{e.name}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{e.type || 'Equipment'}{e.vans?.name ? ` · ${e.vans.name}` : ''}<AlertBadge label="Service" date={e.next_service_date} /><AlertBadge label="Warranty" date={e.warranty_expiry} /></div>
              </div>
              <span style={{ padding: '4px 12px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#f3f4f6', color: STATUS_COLOR[e.status] }}>{e.status?.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
