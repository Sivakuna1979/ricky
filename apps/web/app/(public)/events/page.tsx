'use client'
// @ts-nocheck
import { useState, useEffect } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

/* ─── Mini Calendar ──────────────────────────────────────────────── */
function Calendar({ selected, onSelect, bookedDates, blockedDates }: {
  selected: string
  onSelect: (d: string) => void
  bookedDates: string[]
  blockedDates: string[]
}) {
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const daysInMonth  = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay() // 0=Sun
  const pad = firstWeekday === 0 ? 6 : firstWeekday - 1 // Mon-first

  const monthName = new Date(year, month).toLocaleString('en-GB', { month: 'long', year: 'numeric' })

  const prev = () => { if (month === 0) { setMonth(11); setYear(y=>y-1) } else setMonth(m=>m-1) }
  const next = () => { if (month===11) { setMonth(0);  setYear(y=>y+1) } else setMonth(m=>m+1) }

  const fmt = (d: number) => `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`

  const cell = (d: number) => {
    const dateStr = fmt(d)
    const past    = new Date(dateStr) < today
    const booked  = bookedDates.includes(dateStr)
    const blocked = blockedDates.includes(dateStr)
    const isSelected = dateStr === selected
    const unavail = past || booked || blocked

    let bg = 'transparent', color = '#fff', border = '1px solid transparent', cursor = 'pointer'
    if (isSelected)   { bg='#f97316'; color='#fff'; border='1px solid #f97316' }
    else if (unavail) { bg='rgba(239,68,68,0.12)'; color='rgba(255,255,255,0.25)'; border='1px solid rgba(239,68,68,0.2)'; cursor='default' }
    else              { border='1px solid rgba(255,255,255,0.07)' }

    return (
      <button key={d} onClick={() => !unavail && onSelect(dateStr)}
        title={booked?'Already booked':blocked?'Unavailable':past?'Past date':'Available'}
        style={{ width:'100%', aspectRatio:'1', borderRadius:8, background:bg, color, border, cursor, fontSize:13, fontWeight:isSelected?800:400, position:'relative', transition:'all .15s' }}>
        {d}
        {(booked||blocked) && !isSelected && <span style={{ position:'absolute', bottom:3, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:'#ef4444', display:'block' }} />}
      </button>
    )
  }

  return (
    <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:18, padding:20 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <button onClick={prev} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:20, padding:'4px 8px' }}>‹</button>
        <span style={{ fontWeight:700, fontSize:16, color:'#fff' }}>{monthName}</span>
        <button onClick={next} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:20, padding:'4px 8px' }}>›</button>
      </div>
      {/* Day names */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:6 }}>
        {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.35)', padding:'4px 0' }}>{d}</div>)}
      </div>
      {/* Days */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
        {Array(pad).fill(null).map((_,i)=><div key={`pad-${i}`}/>)}
        {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>cell(d))}
      </div>
      {/* Legend */}
      <div style={{ display:'flex', gap:16, marginTop:14, flexWrap:'wrap' }}>
        {[['#f97316','Selected'],['rgba(239,68,68,0.5)','Unavailable'],['rgba(255,255,255,0.15)','Available']].map(([c,l])=>(
          <div key={l} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'rgba(255,255,255,0.45)' }}>
            <span style={{ width:10,height:10,borderRadius:3,background:c,display:'inline-block' }}/>{l}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Booking Form ───────────────────────────────────────────────── */
function BookingForm({ selectedDate, onDateChange, bookedDates, blockedDates }: {
  selectedDate: string
  onDateChange: (d:string) => void
  bookedDates: string[]
  blockedDates: string[]
}) {
  const [form, setForm] = useState({ name:'', phone:'', email:'', event_time:'', event_location:'', num_guests:'', notes:'', preferred_van:'' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error,   setError]   = useState('')

  const set = (k:string) => (e:any) => setForm(f=>({...f,[k]:e.target.value}))

  const submit = async (e:any) => {
    e.preventDefault()
    if (!selectedDate) { setError('Please select a date from the calendar'); return }
    if (!form.name||!form.email) { setError('Name and email are required'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/events', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ...form, event_date:selectedDate }) })
      const d = await res.json()
      if (!res.ok) setError(d.error ?? 'Submission failed')
      else { setSuccess(d.message ?? 'Booking submitted!'); setForm({ name:'',phone:'',email:'',event_time:'',event_location:'',num_guests:'',notes:'',preferred_van:'' }) }
    } catch { setError('Network error — please try again') }
    finally { setLoading(false) }
  }

  const inp: React.CSSProperties = { width:'100%', padding:'12px 14px', borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.06)', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' }
  const lbl: React.CSSProperties = { display:'block', fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.5)', marginBottom:6 }
  const grp = (label:string, children:React.ReactNode, required=false) => (
    <div style={{ marginBottom:16 }}>
      <label style={lbl}>{label}{required&&<span style={{color:'#f97316'}}> *</span>}</label>
      {children}
    </div>
  )

  return (
    <form onSubmit={submit}>
      {success && (
        <div style={{ background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:12, padding:'16px 18px', marginBottom:20, color:'#6ee7b7', fontSize:14, lineHeight:1.6 }}>
          ✅ {success}
        </div>
      )}
      {error && (
        <div style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:12, padding:'12px 16px', marginBottom:20, color:'#f87171', fontSize:13 }}>
          ⚠ {error}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        {grp('Your Name', <input style={inp} value={form.name} onChange={set('name')} placeholder="John Smith" />, true)}
        {grp('Phone Number', <input style={inp} type="tel" value={form.phone} onChange={set('phone')} placeholder="07700 900000" />)}
      </div>
      {grp('Email Address', <input style={inp} type="email" value={form.email} onChange={set('email')} placeholder="john@example.com" />, true)}

      <div style={{ marginBottom:20, padding:'14px 16px', background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.2)', borderRadius:12 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.5)', marginBottom:6 }}>SELECTED DATE *</div>
        <div style={{ fontSize:18, fontWeight:800, color: selectedDate?'#f97316':'rgba(255,255,255,0.3)' }}>
          {selectedDate ? new Date(selectedDate+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) : 'No date selected — pick one from the calendar'}
        </div>
        {selectedDate && <button type="button" onClick={()=>onDateChange('')} style={{ marginTop:6, background:'none', border:'none', color:'rgba(255,255,255,0.35)', fontSize:12, cursor:'pointer', padding:0 }}>✕ Clear date</button>}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        {grp('Event Time', <input style={inp} type="time" value={form.event_time} onChange={set('event_time')} />)}
        {grp('Number of Guests', <input style={inp} type="number" min="1" value={form.num_guests} onChange={set('num_guests')} placeholder="50" />)}
      </div>
      {grp('Event Location / Venue', <input style={inp} value={form.event_location} onChange={set('event_location')} placeholder="123 High Street, London SW1A 1AA" />)}
      {grp('Preferred Food Van (optional)', (
        <input style={inp} value={form.preferred_van} onChange={set('preferred_van')} placeholder="e.g. Smith's Fish & Chips, any burger van…" />
      ))}
      {grp('Additional Notes', (
        <textarea style={{...inp, minHeight:90, resize:'vertical'}} value={form.notes} onChange={set('notes')} placeholder="Tell us about your event, dietary requirements, theme…" />
      ))}

      <button type="submit" disabled={loading||!selectedDate} style={{ width:'100%', padding:'15px', borderRadius:14, border:'none', background:(loading||!selectedDate)?'rgba(249,115,22,0.35)':'linear-gradient(135deg,#f97316,#ea580c)', color:'#fff', fontWeight:800, fontSize:16, cursor:(loading||!selectedDate)?'not-allowed':'pointer', boxShadow:(loading||!selectedDate)?'none':'0 4px 20px rgba(249,115,22,0.4)', marginTop:8 }}>
        {loading ? 'Submitting…' : '🚐 Request Event Booking'}
      </button>
      <p style={{ fontSize:11, color:'rgba(255,255,255,0.25)', textAlign:'center', marginTop:12 }}>
        We'll contact you within 24 hours to confirm your booking and discuss details.
      </p>
    </form>
  )
}

/* ─── Page ───────────────────────────────────────────────────────── */
export default function EventsPage() {
  const [selectedDate, setSelectedDate] = useState('')
  const [bookedDates,  setBooked]       = useState<string[]>([])
  const [blockedDates, setBlocked]      = useState<string[]>([])

  useEffect(() => {
    fetch('/api/events')
      .then(r=>r.json())
      .then(d => {
        setBooked(d.booked_dates ?? [])
        setBlocked((d.blocked_dates ?? []).map((b:any)=>b.date))
      })
      .catch(()=>{})
  }, [])

  return (
    <>
      <Navbar />
      <main style={{ background:'#080c18', minHeight:'100vh' }}>
        {/* Hero */}
        <section style={{ background:'linear-gradient(160deg,#0a0f1e 0%,#080c18 100%)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'56px 16px 44px' }}>
          <div style={{ maxWidth:700, margin:'0 auto', textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🎪</div>
            <h1 style={{ fontSize:34, fontWeight:900, color:'#fff', margin:'0 0 12px', letterSpacing:'-0.03em' }}>
              Book a Food Van for Your Event
            </h1>
            <p style={{ fontSize:15, color:'rgba(255,255,255,0.45)', margin:'0 0 8px', lineHeight:1.7 }}>
              Corporate events · Weddings · Festivals · Private parties · Street markets
            </p>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.3)', margin:0 }}>
              Pick your date, fill in the form and we'll match you with the perfect food van.
            </p>
          </div>
        </section>

        {/* Types */}
        <section style={{ padding:'32px 16px 0', maxWidth:900, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10 }}>
            {[['🎪','Festivals'],['💒','Weddings'],['🏢','Corporate'],['🎉','Private Parties'],['🎓','Graduation'],['🏟','Sporting Events'],['🛒','Street Markets'],['🎂','Birthdays']].map(([e,l])=>(
              <div key={l} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:'16px 12px', textAlign:'center' }}>
                <div style={{ fontSize:26, marginBottom:6 }}>{e}</div>
                <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.55)' }}>{l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Calendar + Form */}
        <section style={{ padding:'32px 16px 60px', maxWidth:1000, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1.4fr)', gap:24, alignItems:'start' }}>
            {/* Calendar */}
            <div>
              <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', margin:'0 0 14px' }}>1. Pick Your Date</h2>
              <Calendar
                selected={selectedDate}
                onSelect={setSelectedDate}
                bookedDates={bookedDates}
                blockedDates={blockedDates}
              />
              <div style={{ marginTop:16, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:8 }}>WHY FOODTAXI EVENTS?</div>
                {['Vetted & insured food vans','Flexible menus for any dietary need','Live GPS tracking on the day','Easy online payment','Dedicated event manager'].map(f=>(
                  <div key={f} style={{ display:'flex', gap:8, alignItems:'center', fontSize:13, color:'rgba(255,255,255,0.55)', marginBottom:5 }}>
                    <span style={{ color:'#10b981', fontSize:14 }}>✓</span>{f}
                  </div>
                ))}
              </div>
            </div>

            {/* Form */}
            <div>
              <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', margin:'0 0 14px' }}>2. Your Event Details</h2>
              <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:18, padding:'24px 22px' }}>
                <BookingForm selectedDate={selectedDate} onDateChange={setSelectedDate} bookedDates={bookedDates} blockedDates={blockedDates} />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Responsive calendar-on-top for mobile */}
      <style>{`
        @media(max-width:700px){
          section div[style*="grid-template-columns:minmax(0,1fr) minmax(0,1.4fr)"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <Footer />
    </>
  )
}
