// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const EVENT_TYPE_EMOJI = {
  corporate: '🏢', wedding: '💒', birthday: '🎂', festival: '🎪',
  private: '🎉', graduation: '🎓', sports: '🏟', market: '🛒', other: '✨',
}

const FOOD_LABELS = {
  fish_and_chips: '🐟 Fish & Chips', burger: '🍔 Burgers', pizza: '🍕 Pizza',
  coffee: '☕ Coffee Van', ice_cream: '🍦 Ice Cream', street_food: '🌮 Street Food',
  bbq: '🔥 BBQ', dessert: '🍰 Desserts', any: '🍽️ Any',
}

function StatusPill({ status }) {
  const colors = {
    interested: ['#3b82f6', '#eff6ff'],
    accepted_pending_payment: ['#f97316', '#fff7ed'],
    confirmed: ['#10b981', '#ecfdf5'],
    declined: ['#6b7280', '#f3f4f6'],
  }
  const [color, bg] = colors[status] ?? ['#6b7280', '#f3f4f6']
  return (
    <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, color, background: bg, border: `1px solid ${color}33`, textTransform: 'uppercase' }}>
      {status?.replace(/_/g, ' ') ?? 'Not applied'}
    </span>
  )
}

function ApplyModal({ event, onClose, onSubmit }) {
  const [form, setForm] = useState({ van_owner_name: '', van_owner_email: '', business_name: '', notes: '' })
  const [action, setAction] = useState('interested')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!form.van_owner_email) { setError('Email is required'); return }
    setLoading(true); setError('')
    try {
      await onSubmit(event.id, { ...form, status: action === 'accept' ? 'accepted_pending_payment' : 'interested' })
      onClose()
    } catch (e) {
      setError('Submission failed. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: '#111' }}>Apply for Event</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#aaa' }}>×</button>
        </div>

        <div style={{ background: '#f9fafb', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: '#444' }}>
          <b>{event.event_type ? (EVENT_TYPE_EMOJI[event.event_type] || '🎪') + ' ' + event.event_type : '🎪 Event'}</b>
          <div style={{ marginTop: 4, color: '#888' }}>{event.event_date} · {event.event_location || 'Location on request'}</div>
        </div>

        {[['Your Name', 'van_owner_name', 'text', 'Full name'], ['Email Address *', 'van_owner_email', 'email', 'your@email.com'], ['Business / Van Name', 'business_name', 'text', 'e.g. Dave\'s Chippy Van']].map(([lbl, key, type, ph]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>{lbl}</label>
            <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              placeholder={ph}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        ))}

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>Message (optional)</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
            placeholder="Tell FoodTaxi about your van, availability, or any questions…"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[['interested', "I'm Interested", '#3b82f6'], ['accept', 'Accept Event', '#10b981']].map(([val, lbl, color]) => (
            <button key={val} onClick={() => setAction(val)} style={{
              flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: `2px solid ${action === val ? color : '#e5e7eb'}`,
              background: action === val ? color : '#fff',
              color: action === val ? '#fff' : '#888',
            }}>{lbl}</button>
          ))}
        </div>

        {error && <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#ef4444', fontSize: 12, marginBottom: 12 }}>⚠ {error}</div>}

        <button onClick={submit} disabled={loading} style={{
          width: '100%', padding: '13px', borderRadius: 10, border: 'none',
          background: loading ? '#ccc' : action === 'accept' ? '#10b981' : '#3b82f6',
          color: '#fff', fontWeight: 800, fontSize: 15, cursor: loading ? 'wait' : 'pointer',
        }}>
          {loading ? 'Submitting…' : action === 'accept' ? '✅ Accept This Event' : '✋ Express Interest'}
        </button>

        <p style={{ fontSize: 11, color: '#aaa', margin: '10px 0 0', textAlign: 'center' }}>
          FoodTaxi will review your application and release customer details once approved.
        </p>
      </div>
    </div>
  )
}

export default function VanEventsPage() {
  const [opps, setOpps] = useState([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(null)
  const [successId, setSuccessId] = useState(null)
  const [filterFood, setFilterFood] = useState('all')
  const [filterRegion, setFilterRegion] = useState('all')
  const [search, setSearch] = useState('')
  const [postcode, setPostcode] = useState('')
  const [radius, setRadius] = useState('50')
  const [pcSearching, setPcSearching] = useState(false)
  // My applications + in-app messages
  const [myEmail, setMyEmail] = useState('')
  const [myApps, setMyApps] = useState(null)
  const [myLoading, setMyLoading] = useState(false)
  const [thread, setThread] = useState(null)     // application being chatted on
  const [messages, setMessages] = useState([])
  const [msgBody, setMsgBody] = useState('')
  const [msgSending, setMsgSending] = useState(false)

  const loadOpps = (params = '') => {
    setLoading(true)
    fetch(`/api/events/opportunities${params}`).then(r => r.json()).then(d => {
      setOpps(d.opportunities ?? [])
      setLoading(false)
      setPcSearching(false)
    }).catch(() => { setLoading(false); setPcSearching(false) })
  }
  useEffect(() => { loadOpps() }, [])

  const searchByPostcode = () => {
    if (!postcode.trim()) { loadOpps(); return }
    setPcSearching(true)
    loadOpps(`?postcode=${encodeURIComponent(postcode.trim())}&radius=${radius}`)
  }

  const loadMine = async () => {
    if (!myEmail.trim()) return
    setMyLoading(true)
    const d = await fetch(`/api/events/mine?email=${encodeURIComponent(myEmail.trim())}`).then(r => r.json()).catch(() => ({}))
    setMyApps(d.applications ?? [])
    setMyLoading(false)
  }

  const openThread = async (app) => {
    setThread(app)
    setMessages([])
    const d = await fetch(`/api/events/messages?application_id=${app.id}&email=${encodeURIComponent(myEmail.trim())}`).then(r => r.json()).catch(() => ({}))
    setMessages(d.messages ?? [])
  }

  const sendMessage = async () => {
    if (!msgBody.trim() || !thread) return
    setMsgSending(true)
    await fetch('/api/events/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ application_id: thread.id, email: myEmail.trim(), body: msgBody }),
    })
    setMsgBody('')
    const d = await fetch(`/api/events/messages?application_id=${thread.id}&email=${encodeURIComponent(myEmail.trim())}`).then(r => r.json()).catch(() => ({}))
    setMessages(d.messages ?? [])
    setMsgSending(false)
  }

  const handleApply = async (eventId, data) => {
    const res = await fetch('/api/events/applications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId, ...data }),
    })
    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.error ?? 'Failed')
    }
    setSuccessId(eventId)
  }

  const foodTypes = [...new Set(opps.map(o => o.food_type).filter(Boolean))]
  const regions = [...new Set(opps.map(o => o.region).filter(Boolean))].sort()
  const filtered = opps.filter(o =>
    (filterFood === 'all' || o.food_type === filterFood) &&
    (filterRegion === 'all' || o.region === filterRegion) &&
    (!search.trim() || `${o.event_location ?? ''} ${o.region ?? ''} ${o.notes ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  )

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#1e1b4b,#312e81)', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12, height: 56, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
        <span style={{ fontWeight: 900, fontSize: 22 }}>🍟</span>
        <span style={{ fontWeight: 800, fontSize: 17, color: '#fff' }}>FoodTaxi</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Van Event Board</span>
        <div style={{ flex: 1 }} />
        <Link href="/login" style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', fontSize: 12, color: '#fff', textDecoration: 'none', fontWeight: 600 }}>Van Login</Link>
      </div>

      {/* Hero banner */}
      <div style={{ background: 'linear-gradient(135deg,#312e81,#4c1d95)', padding: '32px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(1.4rem,4vw,2rem)', fontWeight: 900, color: '#fff', margin: '0 0 8px' }}>Available Event Opportunities</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
          Express interest or accept events. FoodTaxi handles the customer — you just show up and cook.
        </p>
      </div>

      {/* How it works */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 20px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[['1️⃣', 'Browse events below'], ['2️⃣', 'Express interest or accept'], ['3️⃣', 'FoodTaxi reviews your application'], ['4️⃣', 'Customer details released after approval']].map(([n, t]) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#555' }}>
              <span style={{ fontSize: 16 }}>{n}</span> {t}
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>

        {/* Postcode / distance search */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#312e81', marginBottom: 8 }}>📍 Find events near you</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={postcode} onChange={e => setPostcode(e.target.value)} placeholder="Your postcode (e.g. RH20 1AB)"
              style={{ flex: '2 1 150px', padding: '11px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none', textTransform: 'uppercase' }} />
            <select value={radius} onChange={e => setRadius(e.target.value)}
              style={{ flex: '1 1 110px', padding: '11px 10px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13, fontWeight: 700, color: '#312e81' }}>
              {[['10','Within 10 miles'], ['25','Within 25 miles'], ['50','Within 50 miles'], ['100','Within 100 miles'], ['0','Anywhere (nearest first)']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button onClick={searchByPostcode} disabled={pcSearching}
              style={{ padding: '11px 20px', borderRadius: 10, border: 'none', background: '#312e81', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: pcSearching ? 0.6 : 1 }}>
              {pcSearching ? 'Searching…' : '🔍 Search'}
            </button>
          </div>
        </div>

        {/* UK-wide search + region filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search events anywhere in the UK (town, venue…)"
            style={{ flex: '2 1 220px', padding: '11px 14px', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none', background: '#fff' }} />
          {regions.length > 0 && (
            <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)}
              style={{ flex: '1 1 140px', padding: '11px 12px', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 13, fontWeight: 700, color: '#4c1d95', background: '#fff' }}>
              <option value="all">🗺️ All UK regions</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
        </div>

        {/* Filters */}
        {foodTypes.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <button onClick={() => setFilterFood('all')} style={{ padding: '6px 14px', borderRadius: 20, border: `2px solid ${filterFood === 'all' ? '#6366f1' : '#e5e7eb'}`, background: filterFood === 'all' ? '#6366f1' : '#fff', color: filterFood === 'all' ? '#fff' : '#555', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>All Types</button>
            {foodTypes.map(ft => (
              <button key={ft} onClick={() => setFilterFood(ft)} style={{ padding: '6px 14px', borderRadius: 20, border: `2px solid ${filterFood === ft ? '#6366f1' : '#e5e7eb'}`, background: filterFood === ft ? '#6366f1' : '#fff', color: filterFood === ft ? '#fff' : '#555', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {FOOD_LABELS[ft] ?? ft}
              </button>
            ))}
          </div>
        )}

        {loading && <div style={{ textAlign: 'center', padding: 60, color: '#aaa', fontSize: 15 }}>Loading opportunities…</div>}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#555', marginBottom: 8 }}>No opportunities right now</div>
            <div style={{ fontSize: 13, color: '#aaa' }}>Check back soon — FoodTaxi publishes new events regularly.</div>
          </div>
        )}

        {filtered.map(opp => {
          const isApplied = successId === opp.id
          const daysUntil = Math.ceil((new Date(opp.event_date) - new Date()) / 86400000)
          const isUrgent = opp.urgent || daysUntil <= 7
          return (
            <div key={opp.id} style={{
              background: '#fff', borderRadius: 16, padding: '20px 22px', marginBottom: 14,
              boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
              border: isUrgent ? '2px solid #ef4444' : '1px solid #e5e7eb',
              position: 'relative',
            }}>
              {isUrgent && (
                <div style={{ position: 'absolute', top: 14, right: 14, padding: '2px 10px', borderRadius: 10, background: '#fef2f2', color: '#ef4444', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>🔴 Urgent</div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
                  {EVENT_TYPE_EMOJI[opp.event_type] ?? '🎪'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#111' }}>
                      {opp.event_type ? opp.event_type.charAt(0).toUpperCase() + opp.event_type.slice(1) : 'Event'} Catering
                    </h3>
                    {isApplied && <span style={{ padding: '2px 10px', borderRadius: 10, background: '#ecfdf5', color: '#059669', fontSize: 11, fontWeight: 700 }}>✅ Applied</span>}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: '6px 16px', fontSize: 13, color: '#555', marginBottom: 12 }}>
                    <div>📅 <b>{opp.event_date}</b> {daysUntil > 0 ? `(${daysUntil}d away)` : ''}</div>
                    {opp.event_time && <div>🕐 {opp.event_time}</div>}
                    {opp.event_location && <div>📍 {opp.event_location}</div>}
                    {opp.distance_miles != null && <div style={{ color: '#312e81', fontWeight: 700 }}>🚐 {opp.distance_miles} miles away</div>}
                    {opp.region && <div>🗺️ {opp.region}</div>}
                    {opp.num_guests && <div>👥 ~{opp.num_guests} guests</div>}
                    {opp.food_type && <div>{FOOD_LABELS[opp.food_type] ?? opp.food_type}</div>}
                    {opp.budget && <div>💰 Budget: {opp.budget}</div>}
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                      <span style={{ padding: '4px 12px', borderRadius: 8, background: '#fff7ed', color: '#f97316', fontSize: 12, fontWeight: 700 }}>Booking fee: £{Number(opp.foodtaxi_fee ?? 29.99).toFixed(2)} — only if you're confirmed</span>
                      {opp.commission_pct && <span style={{ padding: '4px 12px', borderRadius: 8, background: '#eff6ff', color: '#3b82f6', fontSize: 12, fontWeight: 700 }}>Commission: {opp.commission_pct}%</span>}
                      {opp.deposit_required && <span style={{ padding: '4px 12px', borderRadius: 8, background: '#f0fdf4', color: '#059669', fontSize: 12, fontWeight: 700 }}>Deposit: £{opp.deposit_required}</span>}
                      {opp.payment_required && <span style={{ padding: '4px 12px', borderRadius: 8, background: '#fef9c3', color: '#854d0e', fontSize: 12, fontWeight: 700 }}>⚠ Fee required before accept</span>}
                    </div>

                  {opp.notes && (
                    <div style={{ padding: '8px 12px', borderRadius: 8, background: '#f9fafb', fontSize: 13, color: '#555', marginBottom: 12, fontStyle: 'italic' }}>
                      "{opp.notes}"
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {!isApplied ? (
                      <>
                        <button onClick={() => setApplying(opp)} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                          ✋ I'm Interested
                        </button>
                        <button onClick={() => setApplying({ ...opp, _quickAccept: true })} style={{ padding: '9px 20px', borderRadius: 10, border: '2px solid #10b981', background: '#fff', color: '#10b981', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                          ✅ Accept Event
                        </button>
                      </>
                    ) : (
                      <div style={{ padding: '9px 16px', borderRadius: 10, background: '#f0fdf4', color: '#059669', fontSize: 13, fontWeight: 700 }}>
                        ✅ Application sent — FoodTaxi will be in touch
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {/* My applications + in-app messages */}
        <div style={{ marginTop: 24, background: '#fff', borderRadius: 16, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#111', marginBottom: 4 }}>📨 My Applications & Messages</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>All event communication happens here on FoodTaxi. Enter the email you applied with.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={myEmail} onChange={e => setMyEmail(e.target.value)} placeholder="your@email.com" type="email"
              style={{ flex: '2 1 180px', padding: '11px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none' }} />
            <button onClick={loadMine} disabled={myLoading || !myEmail.trim()}
              style={{ padding: '11px 20px', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: (myLoading || !myEmail.trim()) ? 0.6 : 1 }}>
              {myLoading ? 'Loading…' : 'Show my applications'}
            </button>
          </div>

          {myApps && myApps.length === 0 && <div style={{ marginTop: 12, fontSize: 13, color: '#999', fontStyle: 'italic' }}>No applications found for that email.</div>}
          {myApps?.map(app => (
            <div key={app.id} style={{ marginTop: 10, padding: '12px 14px', borderRadius: 12, background: '#f9fafb', border: '1px solid #eef0f3' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{app.event?.event_location ?? 'Event'} · {app.event?.event_date ?? ''}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{app.event?.event_type ?? ''}{app.event?.region ? ` · ${app.event.region}` : ''}</div>
                </div>
                <StatusPill status={app.status} />
                {app.paid_at && <span style={{ padding: '2px 10px', borderRadius: 10, background: '#d1fae5', color: '#065f46', fontSize: 10, fontWeight: 800 }}>💳 PAID</span>}
                <button onClick={() => openThread(app)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#312e81', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>💬 Messages</button>
              </div>

              {thread?.id === app.id && (
                <div style={{ marginTop: 10, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
                  <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                    {messages.length === 0 && <div style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>No messages yet — ask FoodTaxi anything about this event.</div>}
                    {messages.map(m => (
                      <div key={m.id} style={{ alignSelf: m.sender === 'van' ? 'flex-end' : 'flex-start', maxWidth: '80%', padding: '8px 12px', borderRadius: 12,
                        background: m.sender === 'van' ? '#312e81' : '#fff', color: m.sender === 'van' ? '#fff' : '#333',
                        border: m.sender === 'van' ? 'none' : '1px solid #e5e7eb', fontSize: 13 }}>
                        {m.sender === 'foodtaxi' && <div style={{ fontSize: 10, fontWeight: 800, color: '#f97316', marginBottom: 2 }}>FOODTAXI</div>}
                        {m.body}
                        <div style={{ fontSize: 9, opacity: 0.6, marginTop: 3 }}>{new Date(m.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={msgBody} onChange={e => setMsgBody(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Type a message…"
                      style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none' }} />
                    <button onClick={sendMessage} disabled={msgSending || !msgBody.trim()}
                      style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#25d366', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', opacity: (msgSending || !msgBody.trim()) ? 0.6 : 1 }}>
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA for non-registered vans */}
        <div style={{ marginTop: 24, background: 'linear-gradient(135deg,#1e1b4b,#312e81)', borderRadius: 16, padding: '24px 20px', textAlign: 'center', color: '#fff' }}>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Not yet a FoodTaxi van partner?</div>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', margin: '0 0 16px' }}>
            Register your van with FoodTaxi to access all events, manage bookings, and grow your business.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/register" style={{ padding: '11px 24px', borderRadius: 10, background: '#f97316', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>Register My Van</a>
            <a href="/search" style={{ padding: '11px 24px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Explore FoodTaxi</a>
          </div>
        </div>
      </div>

      {applying && (
        <ApplyModal
          event={applying}
          onClose={() => setApplying(null)}
          onSubmit={handleApply}
        />
      )}
    </div>
  )
}
