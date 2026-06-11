'use client'
// @ts-nocheck
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

const EVENT_TYPES = [
  { value: 'corporate',  label: 'Corporate Event', emoji: '🏢' },
  { value: 'wedding',    label: 'Wedding',         emoji: '💒' },
  { value: 'birthday',   label: 'Birthday Party',  emoji: '🎂' },
  { value: 'festival',   label: 'Festival',        emoji: '🎪' },
  { value: 'private',    label: 'Private Party',   emoji: '🎉' },
  { value: 'graduation', label: 'Graduation',      emoji: '🎓' },
  { value: 'sports',     label: 'Sporting Event',  emoji: '🏟' },
  { value: 'market',     label: 'Street Market',   emoji: '🛒' },
  { value: 'other',      label: 'Other',           emoji: '✨' },
]

const FOOD_TYPES = [
  { value: 'fish_and_chips', label: '🐟 Fish & Chips' },
  { value: 'burger',         label: '🍔 Burgers' },
  { value: 'pizza',          label: '🍕 Pizza' },
  { value: 'coffee',         label: '☕ Coffee Van' },
  { value: 'ice_cream',      label: '🍦 Ice Cream' },
  { value: 'street_food',    label: '🌮 Street Food' },
  { value: 'bbq',            label: '🔥 BBQ' },
  { value: 'dessert',        label: '🍰 Desserts' },
  { value: 'any',            label: '🍽️ Any / Surprise me' },
]

const STEPS = [
  { n: 1, label: 'Event Type' },
  { n: 2, label: 'Pick a Date' },
  { n: 3, label: 'Your Details' },
  { n: 4, label: 'Review' },
]

function Stepper({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 40 }}>
      {STEPS.map((s, i) => (
        <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 800,
              background: step > s.n ? '#10b981' : step === s.n ? 'linear-gradient(135deg,#f97316,#ea580c)' : 'rgba(255,255,255,0.07)',
              color: step >= s.n ? '#fff' : 'rgba(255,255,255,0.3)',
              border: step < s.n ? '1px solid rgba(255,255,255,0.1)' : 'none',
              boxShadow: step === s.n ? '0 4px 18px rgba(249,115,22,0.4)' : 'none',
              flexShrink: 0,
            }}>
              {step > s.n ? '✓' : s.n}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: step === s.n ? '#f97316' : 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>{s.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{ width: 48, height: 2, background: step > s.n + 1 ? '#10b981' : step > s.n ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.07)', margin: '0 8px', marginBottom: 22, flexShrink: 0 }} />
          )}
        </div>
      ))}
    </div>
  )
}

function Calendar({ selected, onSelect, blockedDates, dateCounts }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const daysInMonth  = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()
  const pad = firstWeekday === 0 ? 6 : firstWeekday - 1
  const monthLabel = new Date(year, month).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
  const fmt = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={prev} style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <span style={{ fontWeight: 700, fontSize: 17, color: '#fff' }}>{monthLabel}</span>
        <button onClick={next} style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 8 }}>
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.35)', padding: '6px 0' }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
        {Array(pad).fill(null).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
          const dateStr = fmt(d)
          const dt = new Date(dateStr + 'T12:00:00')
          const past = dt < today
          const blocked = blockedDates.includes(dateStr)
          const isSel = dateStr === selected
          const count = dateCounts?.[dateStr] ?? 0
          const unavail = past || blocked

          let bg = 'transparent', color = 'rgba(255,255,255,0.85)', border = '1px solid rgba(255,255,255,0.08)', cursor = 'pointer', fw = 400
          if (isSel)        { bg = '#f97316'; color = '#fff'; border = 'none'; fw = 800 }
          else if (blocked) { bg = 'rgba(239,68,68,0.08)'; color = 'rgba(255,255,255,0.2)'; border = '1px solid rgba(239,68,68,0.15)'; cursor = 'not-allowed' }
          else if (past)    { color = 'rgba(255,255,255,0.18)'; cursor = 'not-allowed' }

          return (
            <button key={d} onClick={() => !unavail && onSelect(dateStr)}
              title={blocked ? 'Unavailable' : past ? 'Past date' : count > 0 ? `${count} event request${count > 1 ? 's' : ''} on this day` : 'Available'}
              style={{ aspectRatio: '1', minHeight: 44, borderRadius: 10, background: bg, color, border, cursor, fontSize: 14, fontWeight: fw, position: 'relative', transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1 }}>
              {d}
              {count > 0 && !isSel && !blocked && (
                <span style={{ display: 'flex', gap: 2, position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)' }}>
                  {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                    <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#f97316', display: 'block', opacity: 0.6 }} />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
        {[['#f97316', 'Selected'], ['rgba(239,68,68,0.6)', 'Unavailable'], ['rgba(255,255,255,0.15)', 'Available']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: c, display: 'inline-block', flexShrink: 0 }} />{l}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          <span style={{ display: 'flex', gap: 2 }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#f97316', opacity: 0.6, display: 'inline-block' }} />
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#f97316', opacity: 0.6, display: 'inline-block' }} />
          </span>
          Active requests
        </div>
      </div>
    </div>
  )
}

const INP: any = {
  width: '100%', padding: '14px 16px', borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.06)',
  color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box',
}
const LBL = { display: 'block', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.55)', marginBottom: 7 }

function Field({ label, required = false, children }: any) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={LBL}>{label}{required && <span style={{ color: '#f97316' }}> *</span>}</label>
      {children}
    </div>
  )
}

export default function EventsPage() {
  const [step, setStep] = useState(1)
  const [eventType, setEventType] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [blockedDates, setBlocked] = useState([])
  const [dateCounts, setDateCounts] = useState({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', phone: '', email: '', event_time: '', event_location: '',
    num_guests: '', food_type: '', preferred_van: '', notes: '', budget: '',
  })

  useEffect(() => {
    fetch('/api/events').then(r => r.json()).then(d => {
      setBlocked((d.blocked_dates ?? []).map(b => b.date ?? b))
      setDateCounts(d.date_counts ?? {})
    }).catch(() => {})
  }, [])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    if (!form.name || !form.email) { setError('Name and email are required'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, event_date: selectedDate, event_type: eventType }),
      })
      const d = await res.json()
      if (!res.ok) setError(d.error ?? 'Submission failed')
      else setSuccess(true)
    } catch { setError('Network error — please try again') }
    finally { setLoading(false) }
  }

  const dateLabel = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Not selected'

  if (success) return (
    <>
      <Navbar />
      <main style={{ background: '#080c18', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' }}>
        <div style={{ maxWidth: 540, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 24px' }}>✅</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: '0 0 12px' }}>Request Received!</h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: '0 0 8px' }}>
            FoodTaxi has received your event request.
          </p>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, margin: '0 0 32px' }}>
            We will review your request, match you with available food vans, and contact you within 24 hours.
            You do not need to deal directly with any van — FoodTaxi manages everything for you.
          </p>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 24px', marginBottom: 32, textAlign: 'left' }}>
            {[
              ['📅 Date', dateLabel],
              ['🎪 Event', EVENT_TYPES.find(e => e.value === eventType)?.label ?? eventType],
              ['👤 Name', form.name],
              ['✉️ Email', form.email],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 14 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', minWidth: 90 }}>{k}</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/" style={{ padding: '13px 28px', borderRadius: 12, background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>Back to Home</Link>
            <Link href="/search" style={{ padding: '13px 28px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>Find Food Vans</Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box}
        body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
        .ev-type-card{transition:all .18s;cursor:pointer}
        .ev-type-card:hover{transform:translateY(-3px)}
        @media(max-width:600px){
          .ev-two-col{grid-template-columns:1fr!important}
          .ev-type-grid{grid-template-columns:repeat(3,1fr)!important}
        }
      `}</style>
      <Navbar />
      <main style={{ background: '#080c18', minHeight: '100vh' }}>

        <section style={{ background: 'linear-gradient(160deg,#0a0f1e 0%,#080c18 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '56px 16px 48px' }}>
          <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 20, background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', fontSize: 12, fontWeight: 700, color: '#f97316', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 20 }}>🎪 Event Catering Marketplace</div>
            <h1 style={{ fontSize: 'clamp(1.8rem,5vw,2.8rem)', fontWeight: 900, color: '#fff', margin: '0 0 14px', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              Request a Food Van<br />for Your Event
            </h1>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', margin: '0 0 8px', lineHeight: 1.7 }}>
              Weddings · Festivals · Corporate Events · Private Parties
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', margin: '0 0 8px' }}>
              FoodTaxi matches you with the best available van — you do not deal with vans directly.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 20, marginTop: 20 }}>
              {[['✅', 'Free to enquire'], ['🔒', 'No payment upfront'], ['🛡️', 'FoodTaxi managed'], ['24h', 'Fast response']].map(([icon, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
                  <span style={{ fontSize: 14 }}>{icon}</span>{label}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: '40px 16px 80px', maxWidth: 780, margin: '0 auto' }}>
          <Stepper step={step} />

          {/* Step 1 — Event type */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>What type of event is it?</h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: '0 0 28px' }}>Select the option that best describes your event</p>
              <div className="ev-type-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {EVENT_TYPES.map(t => (
                  <button key={t.value} className="ev-type-card" onClick={() => setEventType(t.value)}
                    style={{ padding: '22px 12px', borderRadius: 16, border: `2px solid ${eventType === t.value ? '#f97316' : 'rgba(255,255,255,0.08)'}`, background: eventType === t.value ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.03)', cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{t.emoji}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: eventType === t.value ? '#f97316' : 'rgba(255,255,255,0.75)', lineHeight: 1.3 }}>{t.label}</div>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 32 }}>
                <button onClick={() => eventType && setStep(2)} disabled={!eventType}
                  style={{ width: '100%', padding: '16px', borderRadius: 14, border: 'none', background: eventType ? 'linear-gradient(135deg,#f97316,#ea580c)' : 'rgba(255,255,255,0.07)', color: eventType ? '#fff' : 'rgba(255,255,255,0.3)', fontWeight: 800, fontSize: 16, cursor: eventType ? 'pointer' : 'not-allowed', boxShadow: eventType ? '0 4px 24px rgba(249,115,22,0.35)' : 'none' }}>
                  Next — Pick a Date →
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Date */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>When is your event?</h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: '0 0 28px' }}>
                Choose any available date — multiple events can happen on the same day. Only red dates are blocked by FoodTaxi.
              </p>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '24px 20px' }}>
                <Calendar
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  blockedDates={blockedDates}
                  dateCounts={dateCounts}
                />
              </div>
              {selectedDate && (
                <div style={{ marginTop: 16, padding: '14px 18px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#f97316' }}>✓ Selected: </span>
                  <span style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>{dateLabel}</span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 24 }}>
                <button onClick={() => setStep(1)} style={{ padding: '15px', borderRadius: 13, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>← Back</button>
                <button onClick={() => selectedDate && setStep(3)} disabled={!selectedDate}
                  style={{ padding: '15px', borderRadius: 13, border: 'none', background: selectedDate ? 'linear-gradient(135deg,#f97316,#ea580c)' : 'rgba(255,255,255,0.07)', color: selectedDate ? '#fff' : 'rgba(255,255,255,0.3)', fontWeight: 800, fontSize: 15, cursor: selectedDate ? 'pointer' : 'not-allowed', boxShadow: selectedDate ? '0 4px 20px rgba(249,115,22,0.35)' : 'none' }}>
                  Next — Your Details →
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Details */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>Tell us about your event</h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: '0 0 28px' }}>FoodTaxi will use these details to find the best available van for you</p>

              <div className="ev-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Full Name" required>
                  <input style={INP} value={form.name} onChange={set('name')} placeholder="Your full name" />
                </Field>
                <Field label="Phone Number">
                  <input style={INP} type="tel" value={form.phone} onChange={set('phone')} placeholder="Your phone number" />
                </Field>
              </div>

              <Field label="Email Address" required>
                <input style={INP} type="email" value={form.email} onChange={set('email')} placeholder="Your email address" />
              </Field>

              <div className="ev-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Event Start Time">
                  <input style={INP} type="time" value={form.event_time} onChange={set('event_time')} />
                </Field>
                <Field label="Number of Guests">
                  <input style={INP} type="number" min="1" value={form.num_guests} onChange={set('num_guests')} placeholder="Approx. number of guests" />
                </Field>
              </div>

              <Field label="Event Location / Venue Address">
                <input style={INP} value={form.event_location} onChange={set('event_location')} placeholder="Venue name, address or postcode" />
              </Field>

              <div className="ev-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Preferred Food Type">
                  <select style={{ ...INP, cursor: 'pointer' }} value={form.food_type} onChange={set('food_type')}>
                    <option value="" style={{ background: '#0a0f1e' }}>Select food type…</option>
                    {FOOD_TYPES.map(f => <option key={f.value} value={f.value} style={{ background: '#0a0f1e' }}>{f.label}</option>)}
                  </select>
                </Field>
                <Field label="Budget (optional)">
                  <input style={INP} value={form.budget} onChange={set('budget')} placeholder="e.g. £500–£1,000" />
                </Field>
              </div>

              <Field label="Notes / Special Requirements">
                <textarea style={{ ...INP, minHeight: 100, resize: 'vertical' }} value={form.notes} onChange={set('notes')} placeholder="Dietary needs, theme, access details, timings, anything else…" />
              </Field>

              {error && <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 13, marginBottom: 16 }}>⚠ {error}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                <button onClick={() => setStep(2)} style={{ padding: '15px', borderRadius: 13, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>← Back</button>
                <button onClick={() => { if (!form.name || !form.email) { setError('Name and email are required'); return } setError(''); setStep(4) }}
                  style={{ padding: '15px', borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 20px rgba(249,115,22,0.35)' }}>
                  Review Request →
                </button>
              </div>
            </div>
          )}

          {/* Step 4 — Review */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>Review your request</h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: '0 0 28px' }}>Check everything looks correct before submitting</p>

              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: '24px', marginBottom: 24 }}>
                {[
                  ['🎪 Event Type', EVENT_TYPES.find(e => e.value === eventType)?.label ?? eventType],
                  ['📅 Date', dateLabel],
                  ['🕐 Time', form.event_time || 'Not specified'],
                  ['👤 Name', form.name],
                  ['📧 Email', form.email],
                  ['📱 Phone', form.phone || 'Not provided'],
                  ['📍 Location', form.event_location || 'Not specified'],
                  ['👥 Guests', form.num_guests || 'Not specified'],
                  ['🍽 Food Type', FOOD_TYPES.find(f => f.value === form.food_type)?.label || 'Any'],
                  ['💰 Budget', form.budget || 'Not specified'],
                  ['💬 Notes', form.notes || 'None'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 16, padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', minWidth: 130, flexShrink: 0, lineHeight: 1.5 }}>{k}</span>
                    <span style={{ fontSize: 14, color: '#fff', fontWeight: 600, lineHeight: 1.5 }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 14, padding: '14px 18px', marginBottom: 24 }}>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.7 }}>
                  🛡️ <strong style={{ color: 'rgba(255,255,255,0.7)' }}>FoodTaxi handles everything.</strong> Your contact details will only be shared with a van once we have matched and approved them for your event. No payment is taken at this stage.
                </p>
              </div>

              {error && <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 13, marginBottom: 16 }}>⚠ {error}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 12 }}>
                <button onClick={() => setStep(3)} style={{ padding: '16px', borderRadius: 13, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>← Edit</button>
                <button onClick={submit} disabled={loading}
                  style={{ padding: '16px', borderRadius: 13, border: 'none', background: loading ? 'rgba(249,115,22,0.4)' : 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', fontWeight: 800, fontSize: 16, cursor: loading ? 'wait' : 'pointer', boxShadow: loading ? 'none' : '0 4px 24px rgba(249,115,22,0.4)' }}>
                  {loading ? '⏳ Submitting…' : '🚐 Send Event Request'}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  )
}
