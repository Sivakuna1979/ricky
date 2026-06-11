// @ts-nocheck
'use client'
import { useEffect, useState, useCallback } from 'react'

const STATUS_CONFIG = {
  new:              { label: 'New',             color: '#6366f1', bg: '#eef2ff' },
  contacted:        { label: 'Contacted',        color: '#f59e0b', bg: '#fffbeb' },
  quote_sent:       { label: 'Quote Sent',       color: '#3b82f6', bg: '#eff6ff' },
  awaiting_deposit: { label: 'Awaiting Deposit', color: '#f97316', bg: '#fff7ed' },
  confirmed:        { label: 'Confirmed',        color: '#10b981', bg: '#ecfdf5' },
  assigned:         { label: 'Assigned',         color: '#059669', bg: '#d1fae5' },
  completed:        { label: 'Completed',        color: '#6b7280', bg: '#f3f4f6' },
  cancelled:        { label: 'Cancelled',        color: '#ef4444', bg: '#fef2f2' },
}

const STATUS_ORDER = ['new','contacted','quote_sent','awaiting_deposit','confirmed','assigned','completed','cancelled']

function Badge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: '#6b7280', bg: '#f3f4f6' }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 12,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}33`,
      textTransform: 'uppercase',
    }}>{cfg.label}</span>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '18px 22px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)', flex: '1 1 140px', minWidth: 130,
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: color ?? '#111' }}>{value ?? '—'}</div>
      <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function DetailPanel({ b, onUpdate, onDelete, saving }) {
  const [notes, setNotes] = useState(b.admin_notes ?? '')
  const [van, setVan] = useState({ assigned_van: b.assigned_van ?? '', assigned_driver: b.assigned_driver ?? '', assigned_contact: b.assigned_contact ?? '' })
  const [pay, setPay] = useState({ total_amount: b.total_amount ?? '', deposit_amount: b.deposit_amount ?? '', deposit_paid: !!b.deposit_paid })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Status buttons */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 6 }}>Status</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {STATUS_ORDER.map(s => {
            const cfg = STATUS_CONFIG[s]
            const active = b.status === s
            return (
              <button key={s} onClick={() => onUpdate(b.id, { status: s })} style={{
                padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: `2px solid ${active ? cfg.color : '#e5e7eb'}`,
                background: active ? cfg.bg : '#fff', color: active ? cfg.color : '#888',
              }}>{cfg.label}</button>
            )
          })}
        </div>
      </div>

      {/* Customer */}
      <div style={{ background: '#f9fafb', borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 8 }}>Customer</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{b.name}</div>
        <a href={`mailto:${b.email}`} style={{ display: 'block', fontSize: 13, color: '#6366f1', marginTop: 3 }}>{b.email}</a>
        {b.phone && <a href={`tel:${b.phone}`} style={{ display: 'block', fontSize: 13, color: '#6366f1', marginTop: 2 }}>{b.phone}</a>}
      </div>

      {/* Event */}
      <div style={{ background: '#f9fafb', borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 8 }}>Event Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px', fontSize: 13, color: '#444' }}>
          <div><b>Date:</b> {b.event_date}</div>
          <div><b>Time:</b> {b.event_time || '—'}</div>
          <div><b>Type:</b> {b.event_type || '—'}</div>
          <div><b>Guests:</b> {b.num_guests || '—'}</div>
          <div style={{ gridColumn: '1/-1' }}><b>Location:</b> {b.event_location || '—'}</div>
          <div><b>Food:</b> {b.food_type || '—'}</div>
          <div><b>Van pref:</b> {b.preferred_van || '—'}</div>
        </div>
        {b.notes && <div style={{ marginTop: 8, fontSize: 13, color: '#555', fontStyle: 'italic' }}>"{b.notes}"</div>}
      </div>

      {/* Van */}
      <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', marginBottom: 8 }}>Van Assignment</div>
        {[['assigned_van','Van / Unit','e.g. Van #1 – Blue Transit'],['assigned_driver','Driver Name','Driver full name'],['assigned_contact','Contact Number','07xxx xxxxxx']].map(([field, lbl, ph]) => (
          <div key={field} style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 2 }}>{lbl}</label>
            <input value={van[field]} onChange={e => setVan(v => ({...v, [field]: e.target.value}))}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
              placeholder={ph} />
          </div>
        ))}
        <button onClick={() => onUpdate(b.id, van)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Save Assignment
        </button>
      </div>

      {/* Payment */}
      <div style={{ background: '#fff7ed', borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', marginBottom: 8 }}>Payment</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 2 }}>Total (£)</label>
            <input type="number" value={pay.total_amount} onChange={e => setPay(p => ({...p, total_amount: e.target.value}))}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 2 }}>Deposit (£)</label>
            <input type="number" value={pay.deposit_amount} onChange={e => setPay(p => ({...p, deposit_amount: e.target.value}))}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={pay.deposit_paid} onChange={e => setPay(p => ({...p, deposit_paid: e.target.checked}))} />
          Deposit Paid
        </label>
        <button onClick={() => onUpdate(b.id, { total_amount: parseFloat(pay.total_amount)||null, deposit_amount: parseFloat(pay.deposit_amount)||null, deposit_paid: pay.deposit_paid })}
          style={{ marginTop: 10, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Save Payment
        </button>
      </div>

      {/* Notes */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 6 }}>Admin Notes</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
          placeholder="Internal notes (not visible to customer)…" />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={() => onUpdate(b.id, { admin_notes: notes })} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Save Notes
          </button>
          <button onClick={() => onDelete(b.id)} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #ef4444', background: '#fff', color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Delete
          </button>
        </div>
      </div>

      {saving && <div style={{ fontSize: 11, color: '#6366f1' }}>Saving…</div>}
      <div style={{ fontSize: 11, color: '#ccc' }}>Submitted: {new Date(b.created_at).toLocaleString('en-GB')}</div>
    </div>
  )
}

export default function AdminEventsPage() {
  const [tab, setTab] = useState('dashboard')
  const [bookings, setBookings] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSearch, setFilterSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [blockedDates, setBlockedDates] = useState([])
  const [newBlock, setNewBlock] = useState({ date: '', reason: '' })
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const [exportMsg, setExportMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [bRes, sRes, bdRes] = await Promise.all([
      fetch('/api/events?admin=1').then(r => r.json()),
      fetch('/api/events/stats').then(r => r.json()),
      fetch('/api/events/blocked-dates').then(r => r.json()),
    ])
    setBookings(bRes.bookings ?? [])
    setStats(sRes)
    setBlockedDates(bdRes.blocked_dates ?? bdRes ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const updateBooking = async (id, patch) => {
    setSaving(true)
    await fetch(`/api/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    await load()
    setSelected(s => s?.id === id ? { ...s, ...patch } : s)
    setSaving(false)
  }

  const deleteBooking = async (id) => {
    if (!confirm('Delete this booking permanently?')) return
    await fetch(`/api/events/${id}`, { method: 'DELETE' })
    setSelected(null)
    await load()
  }

  const addBlock = async () => {
    if (!newBlock.date) return
    await fetch('/api/events/blocked-dates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBlock),
    })
    setNewBlock({ date: '', reason: '' })
    await load()
  }

  const removeBlock = async (id) => {
    await fetch(`/api/events/blocked-dates?id=${id}`, { method: 'DELETE' })
    await load()
  }

  const exportCSV = () => {
    const cols = ['id','name','email','phone','event_date','event_time','event_type','food_type','event_location','num_guests','status','preferred_van','assigned_van','assigned_driver','total_amount','deposit_amount','deposit_paid','admin_notes','created_at']
    const csv = [cols.join(','), ...filtered.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `event-bookings-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    setExportMsg('Downloaded!')
    setTimeout(() => setExportMsg(''), 3000)
  }

  const filtered = bookings.filter(b => {
    if (filterStatus !== 'all' && b.status !== filterStatus) return false
    if (filterSearch) {
      const q = filterSearch.toLowerCase()
      return (b.name ?? '').toLowerCase().includes(q) ||
             (b.email ?? '').toLowerCase().includes(q) ||
             (b.event_date ?? '').includes(q)
    }
    return true
  })

  const calYear = parseInt(calMonth.slice(0,4))
  const calMon  = parseInt(calMonth.slice(5,7)) - 1
  const firstDow = new Date(calYear, calMon, 1).getDay()
  const daysInMonth = new Date(calYear, calMon+1, 0).getDate()
  const calCells = []
  for (let i = 0; i < (firstDow === 0 ? 6 : firstDow - 1); i++) calCells.push(null)
  for (let i = 1; i <= daysInMonth; i++) calCells.push(i)

  const bookingsByDate = {}
  bookings.forEach(b => {
    if (!bookingsByDate[b.event_date]) bookingsByDate[b.event_date] = []
    bookingsByDate[b.event_date].push(b)
  })
  const blockedSet = new Set(blockedDates.map(b => b.blocked_date ?? b.date))
  const today = new Date().toISOString().slice(0,10)

  const TABS = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'bookings',  label: '📋 Bookings' },
    { id: 'calendar',  label: '📅 Calendar' },
    { id: 'blocked',   label: '🚫 Block Dates' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12, height: 56, position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <a href="/admin/dashboard" style={{ color: '#6366f1', fontWeight: 900, textDecoration: 'none', fontSize: 22 }}>🍟</a>
        <span style={{ fontWeight: 800, fontSize: 17, color: '#111' }}>Event Bookings</span>
        <div style={{ flex: 1 }} />
        <button onClick={load} title="Refresh" style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#555' }}>↻</button>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 20px', display: 'flex', gap: 2, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSelected(null) }} style={{
            padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            color: tab === t.id ? '#6366f1' : '#666',
            borderBottom: tab === t.id ? '3px solid #6366f1' : '3px solid transparent',
            whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 80, textAlign: 'center', color: '#aaa', fontSize: 15 }}>Loading…</div>
      ) : (
        <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>

          {/* ── DASHBOARD ── */}
          {tab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <StatCard label="Total Bookings"   value={stats?.total}            color="#6366f1" />
                <StatCard label="Today's Events"   value={stats?.today}            color="#f97316" />
                <StatCard label="This Month"        value={stats?.this_month}       color="#3b82f6" />
                <StatCard label="Pending"           value={stats?.pending}          color="#f59e0b" />
                <StatCard label="Confirmed"         value={stats?.confirmed}        color="#10b981" />
                <StatCard label="Completed"         value={stats?.completed}        color="#6b7280" />
                <StatCard label="Cancelled"         value={stats?.cancelled}        color="#ef4444" />
                <StatCard label="Month Revenue"    value={stats?.revenue_month != null ? `£${Number(stats.revenue_month).toLocaleString()}` : '—'} color="#059669" />
                <StatCard label="Deposits Pending"  value={stats?.deposits_pending} color="#f97316" />
              </div>

              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: '#111' }}>Recent Bookings</div>
                {bookings.length === 0 && <div style={{ color: '#aaa', fontSize: 14 }}>No bookings yet.</div>}
                {bookings.slice(0,8).map(b => (
                  <div key={b.id} onClick={() => { setTab('bookings'); setSelected(b) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{b.name}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{b.event_date} · {b.event_type || 'Event'}</div>
                    </div>
                    <Badge status={b.status ?? 'new'} />
                  </div>
                ))}
                {bookings.length > 8 && (
                  <button onClick={() => setTab('bookings')} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#6366f1', fontWeight: 600 }}>
                    View all {bookings.length} →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── BOOKINGS ── */}
          {tab === 'bookings' && (
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Filters */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
                    placeholder="Search name, email, date…"
                    style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, flex: '1 1 180px', minWidth: 0 }} />
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}>
                    <option value="all">All Statuses</option>
                    {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                  </select>
                  <button onClick={exportCSV} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>↓ Export CSV</button>
                  {exportMsg && <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>{exportMsg}</span>}
                </div>

                <div style={{ fontSize: 12, color: '#999', marginBottom: 10 }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</div>

                {filtered.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 48, color: '#bbb', background: '#fff', borderRadius: 14 }}>No bookings found.</div>
                )}

                {filtered.map(b => {
                  const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.new
                  const isSelected = selected?.id === b.id
                  return (
                    <div key={b.id} onClick={() => setSelected(isSelected ? null : b)} style={{
                      background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 8,
                      boxShadow: isSelected ? `0 0 0 2px ${cfg.color}` : '0 1px 3px rgba(0,0,0,0.07)',
                      cursor: 'pointer', borderLeft: `4px solid ${cfg.color}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{b.name}</div>
                          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                            {b.event_date}{b.event_time ? ` · ${b.event_time}` : ''} · {b.event_type || 'Event'}
                            {b.event_location ? ` · ${b.event_location}` : ''}
                          </div>
                          <div style={{ fontSize: 12, color: '#aaa', marginTop: 1 }}>{b.email}{b.phone ? ` · ${b.phone}` : ''}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <Badge status={b.status ?? 'new'} />
                          {b.total_amount && <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>£{b.total_amount}</span>}
                        </div>
                      </div>
                      {b.assigned_van && <div style={{ marginTop: 5, fontSize: 11, color: '#059669', fontWeight: 600 }}>🚐 {b.assigned_van}{b.assigned_driver ? ` · ${b.assigned_driver}` : ''}</div>}
                    </div>
                  )
                })}
              </div>

              {/* Detail side panel */}
              {selected && (
                <div style={{
                  width: 360, flexShrink: 0, background: '#fff', borderRadius: 14,
                  padding: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                  position: 'sticky', top: 76, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontWeight: 800, fontSize: 16, color: '#111' }}>Booking</span>
                    <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#999', lineHeight: 1 }}>×</button>
                  </div>
                  <DetailPanel key={selected.id} b={selected} onUpdate={updateBooking} onDelete={deleteBooking} saving={saving} />
                </div>
              )}
            </div>
          )}

          {/* ── CALENDAR ── */}
          {tab === 'calendar' && (
            <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <button onClick={() => {
                  const d = new Date(calYear, calMon - 1)
                  setCalMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
                }} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 18 }}>‹</button>
                <div style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 18, color: '#111' }}>
                  {new Date(calYear, calMon).toLocaleString('en-GB', { month: 'long', year: 'numeric' })}
                </div>
                <button onClick={() => {
                  const d = new Date(calYear, calMon + 1)
                  setCalMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
                }} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 18 }}>›</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#aaa', padding: '6px 0', textTransform: 'uppercase' }}>{d}</div>
                ))}
                {calCells.map((day, i) => {
                  if (!day) return <div key={`e${i}`} />
                  const ds = `${calYear}-${String(calMon+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                  const dayBks = bookingsByDate[ds] ?? []
                  const blocked = blockedSet.has(ds)
                  const isToday = ds === today
                  return (
                    <div key={day} style={{
                      minHeight: 72, borderRadius: 8, padding: '5px 6px',
                      background: blocked ? '#fef2f2' : dayBks.length ? '#eff6ff' : '#fafafa',
                      border: isToday ? '2px solid #6366f1' : '1px solid #e5e7eb',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, color: isToday ? '#6366f1' : '#555' }}>{day}</div>
                      {blocked && <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 700 }}>BLOCKED</div>}
                      {dayBks.slice(0,2).map(b => {
                        const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.new
                        return (
                          <div key={b.id} title={`${b.name} — ${b.event_type || 'Event'}`}
                            onClick={() => { setTab('bookings'); setSelected(b) }}
                            style={{ marginTop: 2, padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 600,
                              background: cfg.bg, color: cfg.color, cursor: 'pointer',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {b.name}
                          </div>
                        )
                      })}
                      {dayBks.length > 2 && <div style={{ fontSize: 9, color: '#aaa', marginTop: 1 }}>+{dayBks.length-2}</div>}
                    </div>
                  )
                })}
              </div>

              <div style={{ marginTop: 14, display: 'flex', gap: 16, fontSize: 12, color: '#777', flexWrap: 'wrap' }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 2, marginRight: 4 }} />Has booking</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 2, marginRight: 4 }} />Blocked</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#fff', border: '2px solid #6366f1', borderRadius: 2, marginRight: 4 }} />Today</span>
              </div>
            </div>
          )}

          {/* ── BLOCK DATES ── */}
          {tab === 'blocked' && (
            <div style={{ maxWidth: 600 }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 14 }}>Block a Date</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input type="date" value={newBlock.date} onChange={e => setNewBlock(b => ({...b, date: e.target.value}))}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }} />
                  <input value={newBlock.reason} onChange={e => setNewBlock(b => ({...b, reason: e.target.value}))}
                    placeholder="Reason (Holiday, Maintenance…)"
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, flex: 1, minWidth: 0 }} />
                  <button onClick={addBlock} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    Block Date
                  </button>
                </div>
              </div>

              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 14 }}>Blocked Dates ({blockedDates.length})</div>
                {blockedDates.length === 0 && <div style={{ color: '#bbb', fontSize: 14 }}>No dates blocked.</div>}
                {blockedDates.map(bd => (
                  <div key={bd.id ?? bd.blocked_date} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#ef4444' }}>{bd.blocked_date ?? bd.date}</div>
                      {bd.reason && <div style={{ fontSize: 12, color: '#888' }}>{bd.reason}</div>}
                    </div>
                    <button onClick={() => removeBlock(bd.id)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #ef4444', background: '#fff', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
