// @ts-nocheck
'use client'
import { useEffect, useState, useCallback } from 'react'

// ─── Admin-side status workflow ───────────────────────────────────────────────
const ADMIN_STATUS = {
  new:                  { label: 'New',                  color: '#6366f1', bg: '#eef2ff' },
  reviewing:            { label: 'Reviewing',             color: '#f59e0b', bg: '#fffbeb' },
  published:            { label: 'Published to Vans',    color: '#3b82f6', bg: '#eff6ff' },
  vans_interested:      { label: 'Vans Interested',      color: '#8b5cf6', bg: '#f5f3ff' },
  accepted_by_van:      { label: 'Accepted by Van',      color: '#f97316', bg: '#fff7ed' },
  awaiting_van_fee:     { label: 'Awaiting Van Fee',     color: '#f97316', bg: '#fff7ed' },
  awaiting_deposit:     { label: 'Awaiting Deposit',     color: '#eab308', bg: '#fefce8' },
  confirmed:            { label: 'Confirmed',            color: '#10b981', bg: '#ecfdf5' },
  completed:            { label: 'Completed',            color: '#6b7280', bg: '#f3f4f6' },
  cancelled:            { label: 'Cancelled',            color: '#ef4444', bg: '#fef2f2' },
}

const STATUS_ORDER = [
  'new','reviewing','published','vans_interested',
  'accepted_by_van','awaiting_van_fee','awaiting_deposit',
  'confirmed','completed','cancelled',
]

const EVENT_TYPES = ['Corporate','Wedding','Birthday','Festival','Private','Graduation','Sports','Market','Other']

function Badge({ status }) {
  const cfg = ADMIN_STATUS[status] ?? { label: status, color: '#6b7280', bg: '#f3f4f6' }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 12,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}33`,
      textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>{cfg.label}</span>
  )
}

function StatCard({ label, value, color, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: 12, padding: '18px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)', flex: '1 1 130px', minWidth: 120,
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: color ?? '#111' }}>{value ?? '—'}</div>
      <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{label}</div>
    </div>
  )
}

// In-app chat with a van about their application (staff side)
function AdminChat({ appId }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const load = async () => {
    const d = await fetch(`/api/events/messages?application_id=${appId}`).then(r => r.json()).catch(() => ({}))
    setMessages(d.messages ?? [])
  }
  const toggle = async () => { const next = !open; setOpen(next); if (next) await load() }
  const send = async () => {
    if (!body.trim()) return
    setSending(true)
    await fetch('/api/events/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ application_id: appId, body }) })
    setBody('')
    await load()
    setSending(false)
  }

  return (
    <div style={{ marginTop: 6 }}>
      <button onClick={toggle} style={{ padding: '4px 12px', borderRadius: 8, border: 'none', background: '#312e81', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
        💬 {open ? 'Hide messages' : 'Message van'}
      </button>
      {open && (
        <div style={{ marginTop: 8, background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 10 }}>
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
            {messages.length === 0 && <div style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic' }}>No messages yet</div>}
            {messages.map(m => (
              <div key={m.id} style={{ alignSelf: m.sender === 'foodtaxi' ? 'flex-end' : 'flex-start', maxWidth: '80%', padding: '6px 10px', borderRadius: 10, fontSize: 12,
                background: m.sender === 'foodtaxi' ? '#312e81' : '#f3f4f6', color: m.sender === 'foodtaxi' ? '#fff' : '#333' }}>
                {m.body}
                <div style={{ fontSize: 9, opacity: 0.6, marginTop: 2 }}>{new Date(m.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={body} onChange={e => setBody(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Reply to the van…"
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, outline: 'none' }} />
            <button onClick={send} disabled={sending || !body.trim()} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#25d366', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer', opacity: (sending || !body.trim()) ? 0.6 : 1 }}>Send</button>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailPanel({ b, onUpdate, onDelete, saving, applications, loadApps }) {
  const [notes, setNotes] = useState(b.admin_notes ?? '')
  const [fees, setFees] = useState({
    foodtaxi_fee: b.foodtaxi_fee ?? '',
    commission_pct: b.commission_pct ?? '',
    deposit_required: b.deposit_required ?? '',
    payment_required: !!b.payment_required,
    urgent: !!b.urgent,
  })

  useEffect(() => { loadApps(b.id) }, [b.id])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Status */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 6 }}>Admin Status</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {STATUS_ORDER.map(s => {
            const cfg = ADMIN_STATUS[s]
            const active = b.admin_status === s
            return (
              <button key={s} onClick={() => onUpdate(b.id, { admin_status: s })} style={{
                padding: '3px 9px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: `2px solid ${active ? cfg.color : '#e5e7eb'}`,
                background: active ? cfg.bg : '#fff', color: active ? cfg.color : '#999',
              }}>{cfg.label}</button>
            )
          })}
        </div>
      </div>

      {/* Marketplace toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: b.marketplace_visible ? '#ecfdf5' : '#f9fafb', border: `1px solid ${b.marketplace_visible ? '#6ee7b7' : '#e5e7eb'}` }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>
            {b.marketplace_visible ? '✅ Published to Van Board' : '🔒 Hidden from Vans'}
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            {b.marketplace_visible ? 'Registered vans can see and apply for this event.' : 'Only FoodTaxi admin can see this event.'}
          </div>
        </div>
        <button onClick={() => onUpdate(b.id, { marketplace_visible: !b.marketplace_visible, admin_status: !b.marketplace_visible ? 'published' : 'reviewing' })}
          style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: b.marketplace_visible ? '#ef4444' : '#10b981', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {b.marketplace_visible ? 'Unpublish' : 'Publish to Vans'}
        </button>
      </div>

      {/* Organiser approval gate */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, marginTop: 8, background: b.organiser_approved === false ? '#fffbeb' : '#ecfdf5', border: `1px solid ${b.organiser_approved === false ? '#fde68a' : '#6ee7b7'}` }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>
            {b.organiser_approved === false ? '⏳ Organiser NOT yet confirmed' : '🤝 Organiser confirmed'}
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            {b.organiser_approved === false ? 'Vans can only register interest. Contact the organiser, then approve to unlock Accept.' : 'Vans can Accept this event and pay the booking fee.'}
          </div>
        </div>
        <button onClick={() => onUpdate(b.id, { organiser_approved: b.organiser_approved === false })}
          style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: b.organiser_approved === false ? '#10b981' : '#f59e0b', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {b.organiser_approved === false ? '✓ Mark Confirmed' : 'Revoke'}
        </button>
      </div>

      {/* Customer */}
      <div style={{ background: '#f9fafb', borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 8 }}>Customer</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{b.name}</div>
        <a href={`mailto:${b.email}`} style={{ display: 'block', fontSize: 13, color: '#6366f1', marginTop: 3 }}>{b.email}</a>
        {b.phone && <a href={`tel:${b.phone}`} style={{ display: 'block', fontSize: 13, color: '#6366f1', marginTop: 2 }}>{b.phone}</a>}
        <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: '#fff3cd', fontSize: 11, color: '#92400e', fontWeight: 600 }}>
          🔐 Customer contact only released to van after you approve it manually
        </div>
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
          <div><b>Budget:</b> {b.budget || '—'}</div>
        </div>
        {b.notes && <div style={{ marginTop: 8, fontSize: 13, color: '#555', fontStyle: 'italic' }}>"{b.notes}"</div>}
      </div>

      {/* FoodTaxi Fees */}
      <div style={{ background: '#fff7ed', borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', marginBottom: 8 }}>FoodTaxi Fee Settings</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 2 }}>Lead Fee (£)</label>
            <input type="number" value={fees.foodtaxi_fee} onChange={e => setFees(f => ({ ...f, foodtaxi_fee: e.target.value }))}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
              placeholder="e.g. 20" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 2 }}>Commission %</label>
            <input type="number" value={fees.commission_pct} onChange={e => setFees(f => ({ ...f, commission_pct: e.target.value }))}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
              placeholder="e.g. 10" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 2 }}>Deposit Required (£)</label>
            <input type="number" value={fees.deposit_required} onChange={e => setFees(f => ({ ...f, deposit_required: e.target.value }))}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
              placeholder="e.g. 50" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={fees.payment_required} onChange={e => setFees(f => ({ ...f, payment_required: e.target.checked }))} />
            Payment required before accepting
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={fees.urgent} onChange={e => setFees(f => ({ ...f, urgent: e.target.checked }))} />
            🔴 Urgent
          </label>
        </div>
        <button onClick={() => onUpdate(b.id, {
          foodtaxi_fee: parseFloat(fees.foodtaxi_fee) || null,
          commission_pct: parseFloat(fees.commission_pct) || null,
          deposit_required: parseFloat(fees.deposit_required) || null,
          payment_required: fees.payment_required,
          urgent: fees.urgent,
        })} style={{ marginTop: 10, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Save Fees
        </button>
      </div>

      {/* Applications from vans */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 8 }}>Van Applications ({applications?.length ?? 0})</div>
        {!applications?.length && <div style={{ fontSize: 13, color: '#aaa' }}>No van applications yet.</div>}
        {applications?.map(app => (
          <div key={app.id} style={{ padding: '10px 12px', borderRadius: 8, background: '#f9fafb', marginBottom: 6, border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>{app.business_name || app.van_owner_name || 'Unknown'}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{app.van_owner_email}</div>
                {app.notes && <div style={{ fontSize: 11, color: '#555', marginTop: 3, fontStyle: 'italic' }}>"{app.notes}"</div>}
              </div>
              <span style={{
                padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                background: app.status === 'confirmed' ? '#d1fae5' : app.status === 'declined' ? '#fef2f2' : '#eff6ff',
                color: app.status === 'confirmed' ? '#059669' : app.status === 'declined' ? '#ef4444' : '#3b82f6',
              }}>{app.status?.replace(/_/g, ' ')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#aaa' }}>{new Date(app.created_at).toLocaleDateString('en-GB')}</span>
              {app.paid_at ? (
                <span style={{ padding: '2px 10px', borderRadius: 8, fontSize: 10, fontWeight: 800, background: '#d1fae5', color: '#065f46' }}>💳 FEE PAID £{Number(app.fee ?? 29.99).toFixed(2)}</span>
              ) : (
                <button onClick={async () => {
                  const res = await fetch('/api/events/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ application_id: app.id }) })
                  const d = await res.json().catch(() => ({}))
                  if (d.url) {
                    try { await navigator.clipboard.writeText(d.url) } catch {}
                    prompt('Payment link (copied) — send it to the van via WhatsApp/email:', d.url)
                  } else alert(d.error ?? 'Could not create payment link')
                }} style={{ padding: '4px 12px', borderRadius: 8, border: 'none', background: '#635bff', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                  💳 Get £{Number(b.foodtaxi_fee ?? 29.99).toFixed(2)} payment link
                </button>
              )}
            </div>
            <AdminChat appId={app.id} />
          </div>
        ))}
      </div>

      {/* Admin Notes */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 6 }}>Admin Notes</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
          placeholder="Internal notes — not visible to customer or vans…" />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={() => onUpdate(b.id, { admin_notes: notes })} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save Notes</button>
          <button onClick={() => onDelete(b.id)} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #ef4444', background: '#fff', color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
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
  const [hidePast, setHidePast] = useState(true)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [blockedDates, setBlockedDates] = useState([])
  const [newBlock, setNewBlock] = useState({ date: '', reason: '' })
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const [exportMsg, setExportMsg] = useState('')
  const [applications, setApplications] = useState([])
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [showFinder, setShowFinder] = useState(false)
  const [findArea, setFindArea] = useState('')
  const [locating, setLocating] = useState(false)

  const useMyLocation = () => {
    if (!navigator.geolocation) { setFindMsg('⚠️ Location not available on this device'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          // Reverse geocode to a district name (free, no key)
          const d = await fetch(`https://api.postcodes.io/postcodes?lon=${pos.coords.longitude}&lat=${pos.coords.latitude}`).then(r => r.json())
          const r0 = d?.result?.[0]
          const area = r0?.admin_district || r0?.parish || r0?.postcode || `${pos.coords.latitude.toFixed(3)},${pos.coords.longitude.toFixed(3)}`
          setFindArea(area)
          setFindMsg(`📍 Using your location: ${area}`)
        } catch {
          setFindArea(`${pos.coords.latitude.toFixed(3)},${pos.coords.longitude.toFixed(3)}`)
        }
        setLocating(false)
      },
      () => { setFindMsg('⚠️ Location permission denied'); setLocating(false) },
      { enableHighAccuracy: false, timeout: 10000 }
    )
  }
  const [findMonths, setFindMonths] = useState('12')
  const [findTypes, setFindTypes] = useState('')
  const [finding, setFinding] = useState(false)
  const [found, setFound] = useState(null)
  const [findMsg, setFindMsg] = useState('')
  const [publishing, setPublishing] = useState(false)

  const runFinder = async () => {
    setFinding(true)
    setFindMsg('🤖 Starting the search…')
    setFound(null)
    const res = await fetch('/api/events/discover', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area: findArea, months: parseInt(findMonths), types: findTypes }),
    })
    const d = await res.json().catch(() => ({ error: `Server error (${res.status})` }))
    if (!res.ok || d.error) { setFindMsg(`⚠️ ${d.error ?? 'Could not start the search'}`); setFinding(false); return }

    // Poll every 5s for up to 4 minutes — the search runs on the server
    const started = Date.now()
    const poll = async () => {
      const secs = Math.round((Date.now() - started) / 1000)
      setFindMsg(`🔎 Searching the web… ${secs}s`)
      const s = await fetch(`/api/events/discover?id=${d.id}`).then(r => r.json()).catch(() => null)
      if (s?.status === 'done') {
        const events = s.events ?? []
        if (!events.length) { setFindMsg(`⚠️ ${s.error ?? 'No events found — try a bigger area.'}`); setFinding(false); return }
        setFound(events.map(e => ({ ...e, selected: true })))
        const engineLabel = s.engine === 'google' ? 'Google' : 'Fable'
        setFindMsg(`🤖 ${engineLabel} found ${events.length} events — untick any you don't want, then publish`)
        setFinding(false)
        return
      }
      if (s?.status === 'error') { setFindMsg(`⚠️ ${s.error ?? 'Search failed'}`); setFinding(false); return }
      if (Date.now() - started > 240000) { setFindMsg('⚠️ Search took too long — try a smaller area or fewer months.'); setFinding(false); return }
      setTimeout(poll, 5000)
    }
    setTimeout(poll, 5000)
  }

  const [outreachMsg, setOutreachMsg] = useState('')
  const [outreaching, setOutreaching] = useState(false)
  const [drafts, setDrafts] = useState([])

  const sendInterest = async () => {
    const withEmail = (found ?? []).filter(e => e.selected && e.organiser_email)
    if (!withEmail.length) { setOutreachMsg('⚠️ None of the selected events have an organiser email — use the source links to contact them.'); return }
    setOutreaching(true)
    setOutreachMsg('')
    setDrafts([])
    const res = await fetch('/api/events/outreach', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: withEmail }),
    })
    const d = await res.json().catch(() => ({ error: `Server error (${res.status})` }))
    if (d.error) { setOutreachMsg(`⚠️ ${d.error}`); setOutreaching(false); return }
    const sent = d.results.filter(r => r.status === 'sent').length
    const already = d.results.filter(r => r.status === 'already_sent').length
    const draftList = d.results.filter(r => r.status === 'draft')
    if (d.provider === 'mailto' && draftList.length) {
      setDrafts(draftList)
      setOutreachMsg('✉️ Email service not configured — tap each draft below to send from your own email app.')
    } else {
      setOutreachMsg(`📨 Interest sent to ${sent} organiser(s)${already ? ` · ${already} already contacted` : ''} — replies come to your inbox.`)
    }
    setOutreaching(false)
  }

  const publishFound = async () => {
    const selected = (found ?? []).filter(e => e.selected)
    if (!selected.length) return
    setPublishing(true)
    let ok = 0
    for (const e of selected) {
      const res = await fetch('/api/events/admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_date: e.date,
          event_time: e.event_time || null,
          event_type: e.event_type,
          food_type: 'any',
          event_location: `${e.name} — ${e.location}`,
          region: e.region || null,
          postcode: e.postcode || null,
          num_guests: e.footfall || null,
          notes: `${e.notes ?? ''}${e.source_url ? ` | Source: ${e.source_url}` : ''}`.trim(),
          foodtaxi_fee: 29.99,
          organiser_approved: false, // AI-sourced: secure with the organiser before vans can Accept
        }),
      })
      if (res.ok) ok++
    }
    setFindMsg(`✅ Published ${ok}/${selected.length} events to the van board`)
    setFound(prev => (prev ?? []).filter(e => !e.selected))
    setPublishing(false)
    load()
  }
  const [addForm, setAddForm] = useState({ event_date:'', event_time:'', event_type:'festival', food_type:'any', event_location:'', region:'South East', postcode:'', num_guests:'', budget:'', notes:'', foodtaxi_fee:'29.99', urgent:false, organiser_approved:false })
  const [addSaving, setAddSaving] = useState(false)
  const [addMsg, setAddMsg] = useState('')

  const UK_REGIONS = ['London','South East','South West','East of England','East Midlands','West Midlands','Yorkshire','North West','North East','Wales','Scotland','Northern Ireland']

  const submitAddEvent = async () => {
    if (!addForm.event_date || !addForm.event_location) { setAddMsg('⚠️ Date and location are required'); return }
    setAddSaving(true)
    setAddMsg('')
    const res = await fetch('/api/events/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...addForm, foodtaxi_fee: parseFloat(addForm.foodtaxi_fee) || 29.99 }),
    })
    const d = await res.json().catch(() => ({ error: `Server error (${res.status})` }))
    if (!res.ok || d.error) { setAddMsg(`⚠️ ${d.error ?? 'Failed'}`); setAddSaving(false); return }
    setAddMsg('✅ Published to the van board')
    setAddForm(f => ({ ...f, event_date:'', event_time:'', event_location:'', num_guests:'', budget:'', notes:'', urgent:false }))
    setAddSaving(false)
    load()
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [bRes, sRes, bdRes] = await Promise.all([
      fetch('/api/events?admin=1').then(r => r.json()),
      fetch('/api/events/stats').then(r => r.json()),
      fetch('/api/events/blocked-dates').then(r => r.json()),
    ])
    setBookings(bRes.bookings ?? [])
    setStats(sRes)
    setBlockedDates(bdRes.blocked_dates ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const loadApps = async (eventId) => {
    try {
      const res = await fetch(`/api/events/applications?event_id=${eventId}`)
      if (res.ok) {
        const d = await res.json()
        setApplications(d.applications ?? [])
      }
    } catch {}
  }

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
    if (!confirm('Delete this event request permanently?')) return
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
    const cols = ['id','name','email','phone','event_date','event_time','event_type','food_type','event_location','num_guests','budget','admin_status','marketplace_visible','foodtaxi_fee','commission_pct','deposit_required','urgent','admin_notes','created_at']
    const csv = [cols.join(','), ...filtered.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `event-requests-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    setExportMsg('Downloaded!'); setTimeout(() => setExportMsg(''), 3000)
  }

  const todayStr = new Date().toISOString().slice(0,10)
  const isPast = (b) => b.event_date && b.event_date < todayStr && !['completed','cancelled'].includes(b.admin_status)
  const pastCount = bookings.filter(isPast).length

  const filtered = bookings.filter(b => {
    if (hidePast && isPast(b)) return false
    if (filterStatus !== 'all' && b.admin_status !== filterStatus) return false
    if (filterSearch) {
      const q = filterSearch.toLowerCase()
      return (b.name ?? '').toLowerCase().includes(q) ||
             (b.email ?? '').toLowerCase().includes(q) ||
             (b.event_date ?? '').includes(q) ||
             (b.event_location ?? '').toLowerCase().includes(q)
    }
    return true
  }).sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''))

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
    { id: 'bookings',  label: '📋 Requests' },
    { id: 'calendar',  label: '📅 Calendar' },
    { id: 'blocked',   label: '🚫 Block Dates' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12, height: 56, position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <a href="/admin/dashboard" style={{ color: '#6366f1', fontWeight: 900, textDecoration: 'none', fontSize: 22 }}>🍟</a>
        <span style={{ fontWeight: 800, fontSize: 17, color: '#111' }}>Event Marketplace</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowFinder(v => !v)} style={{ padding: '5px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', fontSize: 12, cursor: 'pointer', color: '#fff', fontWeight: 800 }}>🤖 AI Find Events</button>
        <button onClick={() => setShowAddEvent(v => !v)} style={{ padding: '5px 14px', borderRadius: 8, border: 'none', background: '#10b981', fontSize: 12, cursor: 'pointer', color: '#fff', fontWeight: 800 }}>➕ Add UK Event</button>
        <a href="/van/events" target="_blank" style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>Van Board ↗</a>
        <button onClick={load} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#555' }}>↻</button>
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

      {/* AI Event Finder (staff) — Fable searches the live web */}
      {showFinder && (
        <div style={{ background: '#faf5ff', borderBottom: '1px solid #e9d5ff', padding: '16px 20px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#6b21a8', marginBottom: 4 }}>🤖 AI Event Finder — Fable searches the web for real upcoming events</div>
            <div style={{ fontSize: 12, color: '#7e22ce', marginBottom: 10 }}>Tell it where to look. Review what it finds, untick anything, publish the rest to your customers in one tap.</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: '2 1 200px', display: 'flex', gap: 6 }}>
                <input value={findArea} onChange={e => setFindArea(e.target.value)} placeholder="Area — e.g. West Sussex, Brighton, Surrey…"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #d8b4fe', fontSize: 14, outline: 'none' }} />
                <button onClick={useMyLocation} disabled={locating} title="Use my current location"
                  style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #d8b4fe', background: '#fff', fontSize: 16, cursor: 'pointer', opacity: locating ? 0.6 : 1 }}>
                  {locating ? '…' : '📍'}
                </button>
              </div>
              <select value={findMonths} onChange={e => setFindMonths(e.target.value)} style={{ flex: '1 1 120px', padding: '10px', borderRadius: 10, border: '1px solid #d8b4fe', fontSize: 13, fontWeight: 700, color: '#6b21a8' }}>
                {[['3','Next 3 months'], ['6','Next 6 months'], ['12','Next 12 months'], ['24','Next 2 years']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input value={findTypes} onChange={e => setFindTypes(e.target.value)} placeholder="Types (optional) — e.g. food festivals, county shows"
                style={{ flex: '2 1 180px', padding: '10px 12px', borderRadius: 10, border: '1px solid #d8b4fe', fontSize: 13, outline: 'none' }} />
              <button onClick={runFinder} disabled={finding || !findArea.trim()}
                style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: (finding || !findArea.trim()) ? 0.6 : 1 }}>
                {finding ? '🔎 Searching the web (30–60s)…' : '✨ Find Events'}
              </button>
            </div>
            {findMsg && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: findMsg.startsWith('✅') ? '#059669' : findMsg.startsWith('⚠️') ? '#b45309' : '#6b21a8' }}>{findMsg}</div>}

            {found?.map((e, i) => (
              <div key={i} style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'flex-start', background: '#fff', borderRadius: 10, padding: '10px 12px', border: '1px solid #e9d5ff' }}>
                <input type="checkbox" checked={e.selected} onChange={() => setFound(prev => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))}
                  style={{ width: 20, height: 20, marginTop: 2, accentColor: '#7c3aed' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#111' }}>{e.name}</div>
                  <div style={{ fontSize: 12, color: '#555' }}>📅 {e.date}{e.event_time ? ` · ${e.event_time}` : ''} · 📍 {e.location}{e.postcode ? ` (${e.postcode})` : ''}{e.region ? ` · ${e.region}` : ''}{e.footfall ? ` · 👥 ~${e.footfall}` : ''}</div>
                  {e.notes && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{e.notes}</div>}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                    {e.source_url && <a href={e.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700, textDecoration: 'none' }}>🔗 Check source</a>}
                    {e.organiser_email
                      ? <span style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>📧 {e.organiser_email}</span>
                      : <span style={{ fontSize: 11, color: '#9ca3af' }}>no organiser email found</span>}
                  </div>
                </div>
              </div>
            ))}
            {found && found.some(e => e.selected) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button onClick={publishFound} disabled={publishing}
                  style={{ flex: '2 1 200px', padding: '12px', borderRadius: 10, border: 'none', background: '#10b981', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: publishing ? 0.6 : 1 }}>
                  {publishing ? 'Publishing…' : `🚀 Publish ${found.filter(e => e.selected).length} events to the Van Board`}
                </button>
                <button onClick={sendInterest} disabled={outreaching}
                  style={{ flex: '1 1 160px', padding: '12px', borderRadius: 10, border: 'none', background: '#0e7490', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: outreaching ? 0.6 : 1 }}>
                  {outreaching ? 'Sending…' : `📨 Send interest (${found.filter(e => e.selected && e.organiser_email).length} with email)`}
                </button>
              </div>
            )}
            {outreachMsg && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: outreachMsg.startsWith('📨') ? '#059669' : '#b45309' }}>{outreachMsg}</div>}
            {drafts.map((dft, i) => (
              <a key={i} href={dft.mailto} style={{ display: 'block', marginTop: 6, padding: '10px 12px', borderRadius: 10, background: '#fff', border: '1px solid #e9d5ff', fontSize: 13, fontWeight: 700, color: '#0e7490', textDecoration: 'none' }}>
                ✉️ Send draft to {dft.name} →
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Add UK Event (staff) */}
      {showAddEvent && (
        <div style={{ background: '#ecfdf5', borderBottom: '1px solid #a7f3d0', padding: '16px 20px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#065f46', marginBottom: 10 }}>➕ Add an event you've sourced — publishes straight to the van board</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 8 }}>
              <input type="date" value={addForm.event_date} onChange={e => setAddForm(f => ({ ...f, event_date: e.target.value }))} style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }} />
              <input value={addForm.event_time} onChange={e => setAddForm(f => ({ ...f, event_time: e.target.value }))} placeholder="Time (e.g. 10:00–18:00)" style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }} />
              <select value={addForm.event_type} onChange={e => setAddForm(f => ({ ...f, event_type: e.target.value }))} style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}>
                {['festival','market','sports','corporate','wedding','birthday','private','graduation','other'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={addForm.food_type} onChange={e => setAddForm(f => ({ ...f, food_type: e.target.value }))} style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}>
                {['any','fish_and_chips','burger','pizza','coffee','ice_cream','street_food','bbq','dessert'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
              <input value={addForm.event_location} onChange={e => setAddForm(f => ({ ...f, event_location: e.target.value }))} placeholder="Location / venue *" style={{ gridColumn: 'span 2', padding: '9px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }} />
              <select value={addForm.region} onChange={e => setAddForm(f => ({ ...f, region: e.target.value }))} style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}>
                {UK_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <input value={addForm.postcode} onChange={e => setAddForm(f => ({ ...f, postcode: e.target.value }))} placeholder="Postcode (for distance search)" style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, textTransform: 'uppercase' }} />
              <input value={addForm.num_guests} onChange={e => setAddForm(f => ({ ...f, num_guests: e.target.value }))} placeholder="Est. footfall" type="number" style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }} />
              <input value={addForm.budget} onChange={e => setAddForm(f => ({ ...f, budget: e.target.value }))} placeholder="Pitch cost / budget" style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }} />
              <input value={addForm.foodtaxi_fee} onChange={e => setAddForm(f => ({ ...f, foodtaxi_fee: e.target.value }))} placeholder="Booking fee £" type="number" step="0.01" style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }} />
              <input value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes for vans (organiser, power, pitch size…)" style={{ gridColumn: '1/-1', padding: '9px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }} />
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#991b1b', cursor: 'pointer' }}>
                <input type="checkbox" checked={addForm.urgent} onChange={e => setAddForm(f => ({ ...f, urgent: e.target.checked }))} /> 🔴 Priority event
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#065f46', cursor: 'pointer' }}>
                <input type="checkbox" checked={addForm.organiser_approved} onChange={e => setAddForm(f => ({ ...f, organiser_approved: e.target.checked }))} /> 🤝 Organiser already confirmed
              </label>
              <button onClick={submitAddEvent} disabled={addSaving} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: '#10b981', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: addSaving ? 0.6 : 1 }}>
                {addSaving ? 'Publishing…' : '🚀 Publish to Van Board'}
              </button>
              {addMsg && <span style={{ fontSize: 13, fontWeight: 700, color: addMsg.startsWith('✅') ? '#059669' : '#b45309' }}>{addMsg}</span>}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 80, textAlign: 'center', color: '#aaa', fontSize: 15 }}>Loading…</div>
      ) : (
        <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>

          {/* ── DASHBOARD ── */}
          {tab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <StatCard label="Total Requests"    value={stats?.total}           color="#6366f1" />
                <StatCard label="Today"             value={stats?.today}           color="#f97316" />
                <StatCard label="This Month"        value={stats?.this_month}      color="#3b82f6" />
                <StatCard label="New"               value={stats?.new}             color="#6366f1" onClick={() => { setTab('bookings'); setFilterStatus('new') }} />
                <StatCard label="Reviewing"         value={stats?.reviewing}       color="#f59e0b" />
                <StatCard label="On Van Board"      value={stats?.marketplace_live} color="#3b82f6" />
                <StatCard label="Vans Interested"   value={stats?.vans_interested} color="#8b5cf6" />
                <StatCard label="Confirmed"         value={stats?.confirmed}       color="#10b981" />
                <StatCard label="Completed"         value={stats?.completed}       color="#6b7280" />
                <StatCard label="FoodTaxi Revenue"  value={stats?.revenue_month != null ? `£${Number(stats.revenue_month).toLocaleString()}` : '—'} color="#059669" />
              </div>

              {/* New requests needing action */}
              {bookings.filter(b => b.admin_status === 'new').length > 0 && (
                <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #6366f1' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#6366f1' }}>⚡ New Requests Needing Review</div>
                  {bookings.filter(b => b.admin_status === 'new').map(b => (
                    <div key={b.id} onClick={() => { setTab('bookings'); setSelected(b) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{b.name}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>{b.event_date} · {b.event_type || 'Event'} · {b.event_location || 'Location TBC'}</div>
                      </div>
                      <Badge status="new" />
                    </div>
                  ))}
                </div>
              )}

              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: '#111' }}>All Recent Requests</div>
                {bookings.length === 0 && <div style={{ color: '#aaa', fontSize: 14 }}>No event requests yet.</div>}
                {bookings.slice(0,10).map(b => (
                  <div key={b.id} onClick={() => { setTab('bookings'); setSelected(b) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{b.name}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{b.event_date} · {b.event_type || 'Event'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {b.urgent && <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444' }}>🔴 URGENT</span>}
                      {b.marketplace_visible && <span style={{ fontSize: 10, color: '#3b82f6' }}>📢 LIVE</span>}
                      <Badge status={b.admin_status ?? 'new'} />
                    </div>
                  </div>
                ))}
                {bookings.length > 10 && (
                  <button onClick={() => setTab('bookings')} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#6366f1', fontWeight: 600 }}>
                    View all {bookings.length} →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── REQUESTS ── */}
          {tab === 'bookings' && (
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
                    placeholder="Search name, email, date, location…"
                    style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, flex: '1 1 180px', minWidth: 0 }} />
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}>
                    <option value="all">All Statuses</option>
                    {STATUS_ORDER.map(s => <option key={s} value={s}>{ADMIN_STATUS[s].label}</option>)}
                  </select>
                  <button onClick={exportCSV} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>↓ CSV</button>
                  {exportMsg && <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>{exportMsg}</span>}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={hidePast} onChange={e => setHidePast(e.target.checked)} />
                    Hide finished events{pastCount > 0 ? ` (${pastCount})` : ''}
                  </label>
                </div>

                <div style={{ fontSize: 12, color: '#999', marginBottom: 10 }}>{filtered.length} request{filtered.length !== 1 ? 's' : ''}</div>

                {filtered.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 48, color: '#bbb', background: '#fff', borderRadius: 14 }}>No requests found.</div>
                )}

                {filtered.map(b => {
                  const cfg = ADMIN_STATUS[b.admin_status] ?? ADMIN_STATUS.new
                  const isSelected = selected?.id === b.id
                  return (
                    <div key={b.id} onClick={() => setSelected(isSelected ? null : b)} style={{
                      background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 8,
                      boxShadow: isSelected ? `0 0 0 2px ${cfg.color}` : '0 1px 3px rgba(0,0,0,0.07)',
                      cursor: 'pointer', borderLeft: `4px solid ${cfg.color}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{b.name}</span>
                            {b.urgent && <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', background: '#fef2f2', padding: '1px 6px', borderRadius: 4 }}>URGENT</span>}
                            {b.marketplace_visible && <span style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', background: '#eff6ff', padding: '1px 6px', borderRadius: 4 }}>📢 LIVE</span>}
                            {isPast(b) && <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>⏰ EVENT DATE PASSED</span>}
                          </div>
                          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                            {b.event_date}{b.event_time ? ` · ${b.event_time}` : ''} · {b.event_type || 'Event'}
                            {b.event_location ? ` · ${b.event_location}` : ''}
                          </div>
                          <div style={{ fontSize: 12, color: '#aaa', marginTop: 1 }}>{b.email}{b.phone ? ` · ${b.phone}` : ''}{b.budget ? ` · Budget: ${b.budget}` : ''}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <Badge status={b.admin_status ?? 'new'} />
                          {b.foodtaxi_fee && <span style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>Fee: £{b.foodtaxi_fee}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {selected && (
                <div style={{
                  width: 380, flexShrink: 0, background: '#fff', borderRadius: 14,
                  padding: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                  position: 'sticky', top: 76, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontWeight: 800, fontSize: 16, color: '#111' }}>Event Request</span>
                    <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#999', lineHeight: 1 }}>×</button>
                  </div>
                  <DetailPanel
                    key={selected.id} b={selected}
                    onUpdate={updateBooking} onDelete={deleteBooking}
                    saving={saving} applications={applications} loadApps={loadApps}
                  />
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
                  <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#aaa', padding: '6px 0' }}>{d}</div>
                ))}
                {calCells.map((day, i) => {
                  if (!day) return <div key={`e${i}`} />
                  const ds = `${calYear}-${String(calMon+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                  const dayBks = bookingsByDate[ds] ?? []
                  const blocked = blockedSet.has(ds)
                  const isToday = ds === today
                  const confirmedCount = dayBks.filter(b => b.admin_status === 'confirmed').length
                  const liveCount = dayBks.filter(b => b.marketplace_visible).length
                  return (
                    <div key={day} style={{
                      minHeight: 80, borderRadius: 8, padding: '5px 6px',
                      background: blocked ? '#fef2f2' : dayBks.length > 0 ? '#eff6ff' : '#fafafa',
                      border: isToday ? '2px solid #6366f1' : '1px solid #e5e7eb',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, color: isToday ? '#6366f1' : '#555', marginBottom: 2 }}>{day}</div>
                      {blocked && <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 700 }}>BLOCKED</div>}
                      {dayBks.length > 0 && !blocked && (
                        <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 700 }}>{dayBks.length} request{dayBks.length > 1 ? 's' : ''}</div>
                      )}
                      {confirmedCount > 0 && <div style={{ fontSize: 9, color: '#10b981', fontWeight: 700 }}>✓ {confirmedCount} confirmed</div>}
                      {liveCount > 0 && <div style={{ fontSize: 9, color: '#3b82f6', fontWeight: 700 }}>📢 {liveCount} live</div>}
                      {dayBks.slice(0,2).map(b => {
                        const cfg = ADMIN_STATUS[b.admin_status] ?? ADMIN_STATUS.new
                        return (
                          <div key={b.id} title={`${b.name} — ${b.event_type || 'Event'}`}
                            onClick={() => { setTab('bookings'); setSelected(b) }}
                            style={{ marginTop: 2, padding: '1px 4px', borderRadius: 3, fontSize: 9, fontWeight: 600, background: cfg.bg, color: cfg.color, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {b.name}
                          </div>
                        )
                      })}
                      {dayBks.length > 2 && <div style={{ fontSize: 9, color: '#aaa' }}>+{dayBks.length-2}</div>}
                    </div>
                  )
                })}
              </div>

              <div style={{ marginTop: 14, display: 'flex', gap: 16, fontSize: 12, color: '#777', flexWrap: 'wrap' }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 2, marginRight: 4 }} />Has requests</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 2, marginRight: 4 }} />Blocked</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#fff', border: '2px solid #6366f1', borderRadius: 2, marginRight: 4 }} />Today</span>
              </div>
            </div>
          )}

          {/* ── BLOCK DATES ── */}
          {tab === 'blocked' && (
            <div style={{ maxWidth: 600 }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 6 }}>Block a Date</div>
                <p style={{ fontSize: 13, color: '#888', margin: '0 0 14px' }}>Blocked dates prevent new customer requests. Existing requests are not affected.</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input type="date" value={newBlock.date} onChange={e => setNewBlock(b => ({ ...b, date: e.target.value }))}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }} />
                  <input value={newBlock.reason} onChange={e => setNewBlock(b => ({ ...b, reason: e.target.value }))}
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
                    <button onClick={() => removeBlock(bd.id)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #ef4444', background: '#fff', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Remove</button>
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
