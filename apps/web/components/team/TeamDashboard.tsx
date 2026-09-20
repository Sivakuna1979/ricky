// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'

const CARD = { background: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: 20 }
const LABEL = { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' as const, marginBottom: 8 }
const INPUT = { padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, width: '100%', boxSizing: 'border-box' as const }
const BTN = { padding: '10px 18px', borderRadius: 8, background: '#f97316', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }
const ROLES = ['BUSINESS_ADMIN', 'VAN_MANAGER', 'DRIVER', 'STAFF']

const TABS = ['Staff', 'Shifts', 'Clock In/Out', 'Timesheets'] as const

export function TeamDashboard() {
  const [tab, setTab] = useState<typeof TABS[number]>('Staff')
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', borderRadius: 20, border: tab === t ? 'none' : '1px solid #e5e7eb', background: tab === t ? '#f97316' : '#fff', color: tab === t ? '#fff' : '#555', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{t}</button>
        ))}
      </div>
      {tab === 'Staff' && <StaffTab />}
      {tab === 'Shifts' && <ShiftsTab />}
      {tab === 'Clock In/Out' && <ClockTab />}
      {tab === 'Timesheets' && <TimesheetsTab />}
    </div>
  )
}

function StaffTab() {
  const [staff, setStaff] = useState<any[]>([])
  const [vans, setVans] = useState<any[]>([])
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState<any>({ email: '', role: 'STAFF', van_ids: [] })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = () => {
    fetch('/api/staff').then(r => r.json()).then(d => setStaff(Array.isArray(d) ? d : []))
    fetch('/api/vans').then(r => r.json()).then(d => setVans(Array.isArray(d) ? d : []))
  }
  useEffect(load, [])

  const invite = async () => {
    if (!form.email) return setError('Email required')
    setError(''); setNotice('')
    const res = await fetch('/api/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await res.json()
    if (!res.ok) return setError(d.error ?? 'Failed to invite')
    setNotice(`Invitation sent to ${form.email}`)
    setShowInvite(false); setForm({ email: '', role: 'STAFF', van_ids: [] }); load()
  }

  const toggleVan = (id: string) => {
    setForm((f: any) => ({ ...f, van_ids: f.van_ids.includes(id) ? f.van_ids.filter((v: string) => v !== id) : [...f.van_ids, id] }))
  }

  const deactivate = async (userId: string) => {
    await fetch(`/api/staff/${userId}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button style={BTN} onClick={() => setShowInvite(v => !v)}>{showInvite ? 'Cancel' : '+ Invite staff'}</button>
      </div>
      {notice && <div style={{ ...CARD, background: '#d1fae5', color: '#065f46', fontSize: 13, fontWeight: 600 }}>{notice}</div>}

      {showInvite && (
        <div style={CARD}>
          <input style={{ ...INPUT, marginBottom: 10 }} placeholder="Email address" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <div style={{ marginBottom: 10 }}>
            <div style={LABEL}>Role</div>
            <select style={INPUT} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <div style={LABEL}>Van access — none selected means all vans</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {vans.map((v: any) => (
                <button key={v.id} onClick={() => toggleVan(v.id)} style={{ padding: '6px 12px', borderRadius: 16, border: form.van_ids.includes(v.id) ? 'none' : '1px solid #e5e7eb', background: form.van_ids.includes(v.id) ? '#111' : '#fff', color: form.van_ids.includes(v.id) ? '#fff' : '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{v.name}</button>
              ))}
            </div>
          </div>
          {error && <div style={{ color: '#dc2626', fontSize: 12, margin: '10px 0' }}>{error}</div>}
          <button style={{ ...BTN, marginTop: 14 }} onClick={invite}>Send invitation</button>
        </div>
      )}

      {staff.length === 0 ? <div style={{ ...CARD, textAlign: 'center', color: '#888' }}>No staff invited yet.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {staff.map((s: any) => (
            <div key={s.user_id} style={{ ...CARD, margin: 0, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name || s.email}</div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {s.role?.replace('_', ' ')} · {s.all_vans ? 'All vans' : (s.vans?.join(', ') || 'No van assigned')} · {s.joined_at ? 'Active' : 'Invited — not yet accepted'}
                </div>
              </div>
              {s.is_active && <button onClick={() => deactivate(s.user_id)} style={{ padding: '6px 14px', borderRadius: 8, background: '#fee2e2', color: '#991b1b', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Deactivate</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ShiftsTab() {
  const [shifts, setShifts] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [vans, setVans] = useState<any[]>([])
  const [form, setForm] = useState<any>({ staff_id: '', van_id: '', shift_date: new Date().toISOString().slice(0, 10), start_time: '09:00', end_time: '17:00' })
  const [error, setError] = useState('')

  const load = () => {
    const from = new Date().toISOString().slice(0, 10)
    const to = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    fetch(`/api/shifts?from=${from}&to=${to}`).then(r => r.json()).then(d => setShifts(Array.isArray(d) ? d : []))
    fetch('/api/staff').then(r => r.json()).then(d => setStaff(Array.isArray(d) ? d : []))
    fetch('/api/vans').then(r => r.json()).then(d => setVans(Array.isArray(d) ? d : []))
  }
  useEffect(load, [])

  const submit = async () => {
    if (!form.staff_id) return setError('Select a staff member')
    setError('')
    const res = await fetch('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await res.json()
    if (!res.ok) return setError(d.error ?? 'Failed to create shift')
    load()
  }

  return (
    <div>
      <div style={CARD}>
        <div style={LABEL}>Add a shift (next 7 days shown below)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <select style={INPUT} value={form.staff_id} onChange={e => setForm({ ...form, staff_id: e.target.value })}>
            <option value="">Staff member…</option>
            {staff.flatMap((s: any) => s.staff_ids.map((id: string) => <option key={id} value={id}>{s.name || s.email}</option>))}
          </select>
          <select style={INPUT} value={form.van_id} onChange={e => setForm({ ...form, van_id: e.target.value })}>
            <option value="">Van (optional)…</option>
            {vans.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <input style={INPUT} type="date" value={form.shift_date} onChange={e => setForm({ ...form, shift_date: e.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={INPUT} type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
            <input style={INPUT} type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
          </div>
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{error}</div>}
        <button style={BTN} onClick={submit}>Add shift</button>
      </div>

      {shifts.length === 0 ? <div style={{ ...CARD, textAlign: 'center', color: '#888' }}>No upcoming shifts.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shifts.map((s: any) => (
            <div key={s.id} style={{ ...CARD, margin: 0, padding: '14px 16px', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{s.staff?.users?.full_name || s.staff?.users?.email}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{s.shift_date} · {s.start_time}–{s.end_time}{s.vans?.name ? ` · ${s.vans.name}` : ''}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ClockTab() {
  const [status, setStatus] = useState<'loading' | 'in' | 'out' | 'not_staff'>('loading')
  const [error, setError] = useState('')

  const check = () => {
    fetch('/api/time-entries/status').then(r => r.json()).then(d => setStatus(d.clocked_in ? 'in' : 'out')).catch(() => setStatus('out'))
  }
  useEffect(check, [])

  const clockIn = async () => {
    setError('')
    const res = await fetch('/api/time-entries/clock-in', { method: 'POST' })
    const d = await res.json()
    if (!res.ok) return setError(d.error ?? 'Could not clock in')
    setStatus('in')
  }
  const clockOut = async () => {
    setError('')
    const res = await fetch('/api/time-entries/clock-out', { method: 'POST' })
    const d = await res.json()
    if (!res.ok) return setError(d.error ?? 'Could not clock out')
    setStatus('out')
  }

  return (
    <div style={{ ...CARD, textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{status === 'in' ? '🟢' : '⏱️'}</div>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>{status === 'in' ? "You're clocked in" : 'Not clocked in'}</div>
      {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {status === 'in'
        ? <button style={{ ...BTN, background: '#dc2626', padding: '14px 32px', fontSize: 15 }} onClick={clockOut}>Clock Out</button>
        : <button style={{ ...BTN, background: '#059669', padding: '14px 32px', fontSize: 15 }} onClick={clockIn}>Clock In</button>}
    </div>
  )
}

function TimesheetsTab() {
  const [data, setData] = useState<any>(null)
  const [range, setRange] = useState<'today' | 'week'>('week')

  useEffect(() => {
    const from = range === 'today' ? new Date().toISOString().slice(0, 10) : new Date(Date.now() - 7 * 86400000).toISOString()
    fetch(`/api/time-entries?from=${from}`).then(r => r.json()).then(setData)
  }, [range])

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['today', 'week'] as const).map(r => (
          <button key={r} onClick={() => setRange(r)} style={{ padding: '6px 14px', borderRadius: 16, border: range === r ? 'none' : '1px solid #e5e7eb', background: range === r ? '#111' : '#fff', color: range === r ? '#fff' : '#555', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{r === 'today' ? 'Today' : 'This week'}</button>
        ))}
      </div>
      <div style={{ ...CARD, textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 24, fontWeight: 800 }}>{data?.total_hours ?? 0} hrs</div>
        <div style={{ fontSize: 11, color: '#888' }}>TOTAL HOURS</div>
      </div>
      {(data?.entries ?? []).length === 0 ? <div style={{ ...CARD, textAlign: 'center', color: '#888' }}>No time entries in this range.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.entries.map((e: any) => (
            <div key={e.id} style={{ ...CARD, margin: 0, padding: '14px 16px', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{e.staff?.users?.full_name || e.staff?.users?.email}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{new Date(e.clock_in_at).toLocaleString('en-GB')}{e.clock_out_at ? ` – ${new Date(e.clock_out_at).toLocaleTimeString('en-GB')}` : ' (still clocked in)'}{e.is_manual_adjustment ? ' · corrected' : ''}</div>
              </div>
              <div style={{ fontWeight: 700 }}>{e.duration_minutes !== null ? `${(e.duration_minutes / 60).toFixed(1)}h` : '—'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
