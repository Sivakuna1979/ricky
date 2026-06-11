'use client'
// @ts-nocheck
import { useEffect, useState } from 'react'
import Link from 'next/link'

const NAV = [
  { label:'Dashboard',   icon:'📊', href:'/admin/dashboard'   },
  { label:'Businesses',  icon:'🚐', href:'/admin/businesses'  },
  { label:'Events',      icon:'🎪', href:'/admin/events'      },
  { label:'Invitations', icon:'📨', href:'/admin/invitations' },
  { label:'Discovery',   icon:'🔍', href:'/admin/discovery'   },
  { label:'Users',       icon:'👥', href:'/admin/users'       },
  { label:'Settings',    icon:'⚙️', href:'/admin/settings'    },
]

type Booking = {
  id: string; name: string; email: string; phone: string
  event_date: string; event_time: string; event_location: string
  num_guests: number; notes: string; preferred_van: string
  status: 'pending'|'accepted'|'declined'; created_at: string
}

const STATUS_COLOR: Record<string, string> = {
  pending:  '#f59e0b',
  accepted: '#10b981',
  declined: '#ef4444',
}

export default function AdminEventsPage() {
  const [bookings, setBookings]   = useState<Booking[]>([])
  const [blocked,  setBlocked]    = useState<{id:string;blocked_date:string;reason:string}[]>([])
  const [loading,  setLoading]    = useState(true)
  const [newBlock, setNewBlock]   = useState('')
  const [blockReason, setBlockReason] = useState('')
  const [tab, setTab]             = useState<'bookings'|'calendar'>('bookings')
  const [filter, setFilter]       = useState<'all'|'pending'|'accepted'|'declined'>('all')

  const load = async () => {
    const [b, bd] = await Promise.all([
      fetch('/api/events?admin=1').then(r=>r.json()),
      fetch('/api/events/blocked-dates').then(r=>r.json()),
    ])
    setBookings(b.bookings ?? [])
    setBlocked(bd.blocked ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/events/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status}) })
    setBookings(bs => bs.map(b => b.id===id ? {...b,status:status as any} : b))
  }

  const deleteBooking = async (id: string) => {
    if (!confirm('Delete this booking?')) return
    await fetch(`/api/events/${id}`, { method:'DELETE' })
    setBookings(bs => bs.filter(b=>b.id!==id))
  }

  const blockDate = async () => {
    if (!newBlock) return
    await fetch('/api/events/blocked-dates', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({date:newBlock,reason:blockReason||null}) })
    setNewBlock(''); setBlockReason(''); load()
  }

  const unblockDate = async (date: string) => {
    await fetch(`/api/events/blocked-dates?date=${date}`, { method:'DELETE' })
    setBlocked(bs => bs.filter(b=>b.blocked_date!==date))
  }

  const shown = bookings.filter(b => filter==='all' || b.status===filter)

  const inp: React.CSSProperties = { padding:'10px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.06)', color:'#fff', fontSize:14, outline:'none' }

  return (
    <>
      <style>{`html,body{margin:0;padding:0} .adm-wrap{display:flex;flex-direction:column;min-height:100vh;background:#070b14;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif}`}</style>
      <div className="adm-wrap">
        {/* Topbar */}
        <div style={{ background:'rgba(255,255,255,0.04)', borderBottom:'1px solid rgba(255,255,255,0.08)', padding:'0 20px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:'linear-gradient(135deg,#f97316,#ea580c)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>FT</div>
            <span style={{ fontWeight:800, fontSize:16, color:'#fff' }}>FoodTaxi Admin</span>
          </div>
          <Link href="/" style={{ fontSize:13, color:'rgba(255,255,255,0.4)', textDecoration:'none' }}>← Back to site</Link>
        </div>

        <div style={{ display:'flex', flex:1 }}>
          {/* Sidebar */}
          <nav style={{ width:200, background:'rgba(255,255,255,0.02)', borderRight:'1px solid rgba(255,255,255,0.06)', padding:'20px 10px', flexShrink:0 }}>
            {NAV.map(n=>(
              <Link key={n.href} href={n.href} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, marginBottom:4, textDecoration:'none', background:n.href==='/admin/events'?'rgba(249,115,22,0.15)':'transparent', color:n.href==='/admin/events'?'#f97316':'rgba(255,255,255,0.6)', fontWeight:n.href==='/admin/events'?700:400, fontSize:14 }}>
                {n.icon} {n.label}
              </Link>
            ))}
          </nav>

          {/* Main */}
          <main style={{ flex:1, padding:24, overflowX:'hidden' }}>
            <h1 style={{ fontSize:24, fontWeight:800, margin:'0 0 4px' }}>🎪 Event Bookings</h1>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.35)', margin:'0 0 24px' }}>Manage event booking requests and block unavailable dates</p>

            {/* Tabs */}
            <div style={{ display:'flex', gap:6, marginBottom:20 }}>
              {([['bookings','📋 Bookings'],['calendar','📅 Block Dates']] as const).map(([k,l])=>(
                <button key={k} onClick={()=>setTab(k)} style={{ padding:'8px 20px', borderRadius:20, border:'none', cursor:'pointer', fontWeight:700, fontSize:13, background:tab===k?'#f97316':'rgba(255,255,255,0.08)', color:tab===k?'#fff':'rgba(255,255,255,0.5)' }}>{l}</button>
              ))}
            </div>

            {loading && <div style={{ color:'rgba(255,255,255,0.4)', padding:'40px 0', textAlign:'center' }}>Loading…</div>}

            {!loading && tab==='bookings' && (
              <>
                {/* Filter */}
                <div style={{ display:'flex', gap:6, marginBottom:16 }}>
                  {(['all','pending','accepted','declined'] as const).map(f=>(
                    <button key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 14px', borderRadius:16, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background:filter===f?(f==='all'?'#6366f1':STATUS_COLOR[f]):'rgba(255,255,255,0.06)', color:filter===f?'#fff':'rgba(255,255,255,0.4)', textTransform:'capitalize' }}>
                      {f} {f==='all'?`(${bookings.length})`:`(${bookings.filter(b=>b.status===f).length})`}
                    </button>
                  ))}
                </div>

                {shown.length===0 && <div style={{ textAlign:'center', padding:'60px 0', color:'rgba(255,255,255,0.3)' }}>No bookings found</div>}

                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {shown.map(b => (
                    <div key={b.id} style={{ background:'rgba(255,255,255,0.04)', border:`1px solid ${STATUS_COLOR[b.status]}33`, borderRadius:14, padding:20 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8 }}>
                        <div>
                          <div style={{ fontWeight:800, fontSize:16, color:'#fff', marginBottom:3 }}>{b.name}</div>
                          <div style={{ fontSize:13, color:'rgba(255,255,255,0.45)' }}>{b.email} {b.phone && `· ${b.phone}`}</div>
                        </div>
                        <span style={{ background:`${STATUS_COLOR[b.status]}22`, color:STATUS_COLOR[b.status], border:`1px solid ${STATUS_COLOR[b.status]}44`, padding:'4px 12px', borderRadius:12, fontSize:12, fontWeight:700, textTransform:'uppercase' }}>
                          {b.status}
                        </span>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10, marginTop:14 }}>
                        {[['📅 Date', b.event_date ? new Date(b.event_date+'T12:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'}) : '—'],
                          ['🕐 Time', b.event_time||'—'],
                          ['📍 Location', b.event_location||'—'],
                          ['👥 Guests', b.num_guests||'—'],
                          ['🚐 Preferred Van', b.preferred_van||'Any'],
                        ].map(([k,v])=>(
                          <div key={k as string} style={{ background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'8px 12px' }}>
                            <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginBottom:3 }}>{k}</div>
                            <div style={{ fontSize:13, color:'rgba(255,255,255,0.8)', fontWeight:600 }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      {b.notes && <div style={{ marginTop:12, fontSize:13, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'10px 12px' }}>💬 {b.notes}</div>}
                      <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
                        {b.status!=='accepted' && <button onClick={()=>updateStatus(b.id,'accepted')} style={{ padding:'8px 16px', borderRadius:10, border:'none', background:'#10b981', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>✓ Accept</button>}
                        {b.status!=='pending'  && <button onClick={()=>updateStatus(b.id,'pending')}  style={{ padding:'8px 16px', borderRadius:10, border:'none', background:'#f59e0b', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>⏳ Pending</button>}
                        {b.status!=='declined' && <button onClick={()=>updateStatus(b.id,'declined')} style={{ padding:'8px 16px', borderRadius:10, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.2)', color:'#f87171', fontWeight:700, fontSize:13, cursor:'pointer' }}>✗ Decline</button>}
                        <button onClick={()=>deleteBooking(b.id)} style={{ padding:'8px 16px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(255,255,255,0.4)', fontWeight:700, fontSize:13, cursor:'pointer', marginLeft:'auto' }}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!loading && tab==='calendar' && (
              <div style={{ maxWidth:520 }}>
                <h2 style={{ fontSize:16, fontWeight:700, color:'#fff', margin:'0 0 16px' }}>Block Unavailable Dates</h2>
                <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
                  <input type="date" value={newBlock} onChange={e=>setNewBlock(e.target.value)} style={{...inp,flex:'0 0 auto'}} />
                  <input placeholder="Reason (optional)" value={blockReason} onChange={e=>setBlockReason(e.target.value)} style={{...inp,flex:1,minWidth:140}} />
                  <button onClick={blockDate} disabled={!newBlock} style={{ padding:'10px 20px', borderRadius:10, border:'none', background:newBlock?'#f97316':'rgba(249,115,22,0.3)', color:'#fff', fontWeight:700, cursor:newBlock?'pointer':'not-allowed', fontSize:14 }}>Block Date</button>
                </div>

                {blocked.length===0 && <div style={{ color:'rgba(255,255,255,0.35)', fontSize:14 }}>No blocked dates set.</div>}
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {blocked.map(b=>(
                    <div key={b.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, padding:'10px 14px' }}>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>{new Date(b.blocked_date+'T12:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'long',year:'numeric'})}</div>
                        {b.reason && <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginTop:2 }}>{b.reason}</div>}
                      </div>
                      <button onClick={()=>unblockDate(b.blocked_date)} style={{ padding:'6px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.15)', background:'transparent', color:'rgba(255,255,255,0.5)', fontSize:12, cursor:'pointer' }}>Unblock</button>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop:24, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:16 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.35)', marginBottom:10 }}>PENDING BOOKINGS</div>
                  {bookings.filter(b=>b.status==='pending'||b.status==='accepted').length===0
                    ? <div style={{ fontSize:13, color:'rgba(255,255,255,0.3)' }}>No upcoming bookings</div>
                    : bookings.filter(b=>b.status==='pending'||b.status==='accepted').map(b=>(
                      <div key={b.id} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color:'rgba(255,255,255,0.6)' }}>{b.event_date}</span>
                        <span style={{ color:'rgba(255,255,255,0.8)', fontWeight:600 }}>{b.name}</span>
                        <span style={{ color:STATUS_COLOR[b.status], fontWeight:700, textTransform:'capitalize' }}>{b.status}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  )
}
