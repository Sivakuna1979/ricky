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

const STATUS_COLOR: Record<string,string> = {
  pending:'#f59e0b', accepted:'#10b981', declined:'#ef4444',
}

type Booking = {
  id:string; name:string; email:string; phone:string
  event_type:string; event_date:string; event_time:string; event_location:string
  num_guests:number; food_type:string; notes:string; preferred_van:string
  status:'pending'|'accepted'|'declined'; admin_notes:string; assigned_van_id:string; created_at:string
}

function exportCSV(bookings: Booking[]) {
  const cols = ['Name','Email','Phone','Event Type','Date','Time','Location','Guests','Food Type','Preferred Van','Notes','Status','Admin Notes','Created']
  const rows = bookings.map(b=>[
    b.name,b.email,b.phone,b.event_type,b.event_date,b.event_time,b.event_location,
    b.num_guests,b.food_type,b.preferred_van,b.notes,b.status,b.admin_notes,
    b.created_at?new Date(b.created_at).toLocaleDateString('en-GB'):''
  ].map(v=>JSON.stringify(v??'')))
  const csv = [cols.join(','), ...rows.map(r=>r.join(','))].join('\n')
  const a = document.createElement('a')
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
  a.download = `event-bookings-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
}

export default function AdminEventsPage() {
  const [bookings,   setBookings]   = useState<Booking[]>([])
  const [blocked,    setBlocked]    = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState<'bookings'|'calendar'>('bookings')
  const [filter,     setFilter]     = useState<'all'|'pending'|'accepted'|'declined'>('all')
  const [expanded,   setExpanded]   = useState<string|null>(null)
  const [adminNotes, setAdminNotes] = useState<Record<string,string>>({})
  const [newBlock,   setNewBlock]   = useState('')
  const [blockReason,setBlockReason]= useState('')

  const load = async () => {
    const [b, bd] = await Promise.all([
      fetch('/api/events?admin=1').then(r=>r.json()),
      fetch('/api/events/blocked-dates').then(r=>r.json()),
    ])
    setBookings(b.bookings??[])
    setBlocked(bd.blocked??[])
    const notes: Record<string,string> = {}
    for (const bk of (b.bookings??[])) if (bk.admin_notes) notes[bk.id]=bk.admin_notes
    setAdminNotes(notes)
    setLoading(false)
  }
  useEffect(()=>{ load() },[])

  const updateStatus = async (id:string, status:string) => {
    await fetch(`/api/events/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})})
    setBookings(bs=>bs.map(b=>b.id===id?{...b,status:status as any}:b))
  }
  const saveNotes = async (id:string) => {
    await fetch(`/api/events/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({admin_notes:adminNotes[id]??''})})
  }
  const deleteBooking = async (id:string) => {
    if (!confirm('Delete this booking permanently?')) return
    await fetch(`/api/events/${id}`,{method:'DELETE'})
    setBookings(bs=>bs.filter(b=>b.id!==id))
  }
  const blockDate = async () => {
    if (!newBlock) return
    await fetch('/api/events/blocked-dates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:newBlock,reason:blockReason||null})})
    setNewBlock(''); setBlockReason(''); load()
  }
  const unblockDate = async (date:string) => {
    await fetch(`/api/events/blocked-dates?date=${date}`,{method:'DELETE'})
    setBlocked(bs=>bs.filter(b=>b.blocked_date!==date))
  }

  const shown = bookings.filter(b=>filter==='all'||b.status===filter)

  const inp: React.CSSProperties = {padding:'10px 14px',borderRadius:10,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.06)',color:'#fff',fontSize:14,outline:'none'}

  return (
    <>
      <style>{`html,body{margin:0;padding:0}.adm-wrap{display:flex;flex-direction:column;min-height:100vh;background:#070b14;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif}`}</style>
      <div className="adm-wrap">
        {/* Topbar */}
        <div style={{background:'rgba(255,255,255,0.04)',borderBottom:'1px solid rgba(255,255,255,0.08)',padding:'0 20px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:30,height:30,borderRadius:8,background:'linear-gradient(135deg,#f97316,#ea580c)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:'#fff',fontSize:13}}>FT</div>
            <span style={{fontWeight:800,fontSize:16,color:'#fff'}}>FoodTaxi Admin</span>
          </div>
          <Link href="/" style={{fontSize:13,color:'rgba(255,255,255,0.4)',textDecoration:'none'}}>← Back to site</Link>
        </div>

        <div style={{display:'flex',flex:1}}>
          {/* Sidebar */}
          <nav style={{width:200,background:'rgba(255,255,255,0.02)',borderRight:'1px solid rgba(255,255,255,0.06)',padding:'20px 10px',flexShrink:0}}>
            {NAV.map(n=>(
              <Link key={n.href} href={n.href} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:10,marginBottom:4,textDecoration:'none',background:n.href==='/admin/events'?'rgba(249,115,22,0.15)':'transparent',color:n.href==='/admin/events'?'#f97316':'rgba(255,255,255,0.6)',fontWeight:n.href==='/admin/events'?700:400,fontSize:14}}>
                {n.icon} {n.label}
              </Link>
            ))}
          </nav>

          {/* Main */}
          <main style={{flex:1,padding:24,overflowX:'hidden',minWidth:0}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12,marginBottom:24}}>
              <div>
                <h1 style={{fontSize:24,fontWeight:800,margin:'0 0 4px'}}>🎪 Event Bookings</h1>
                <p style={{fontSize:13,color:'rgba(255,255,255,0.35)',margin:0}}>{bookings.length} total · {bookings.filter(b=>b.status==='pending').length} pending</p>
              </div>
              <button onClick={()=>exportCSV(bookings)} style={{padding:'10px 20px',borderRadius:10,border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.7)',fontWeight:700,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:7}}>
                📥 Export CSV
              </button>
            </div>

            {/* Tabs */}
            <div style={{display:'flex',gap:6,marginBottom:20}}>
              {([['bookings','📋 Bookings'],['calendar','📅 Block Dates']] as const).map(([k,l])=>(
                <button key={k} onClick={()=>setTab(k)} style={{padding:'8px 20px',borderRadius:20,border:'none',cursor:'pointer',fontWeight:700,fontSize:13,background:tab===k?'#f97316':'rgba(255,255,255,0.08)',color:tab===k?'#fff':'rgba(255,255,255,0.5)'}}>
                  {l}
                </button>
              ))}
            </div>

            {loading && <div style={{color:'rgba(255,255,255,0.4)',padding:'60px 0',textAlign:'center',fontSize:16}}>Loading…</div>}

            {/* ── Bookings tab ── */}
            {!loading && tab==='bookings' && (
              <>
                <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
                  {(['all','pending','accepted','declined'] as const).map(f=>(
                    <button key={f} onClick={()=>setFilter(f)} style={{padding:'6px 14px',borderRadius:16,border:'none',cursor:'pointer',fontSize:12,fontWeight:700,background:filter===f?(f==='all'?'#6366f1':STATUS_COLOR[f]):'rgba(255,255,255,0.06)',color:filter===f?'#fff':'rgba(255,255,255,0.4)',textTransform:'capitalize'}}>
                      {f} ({f==='all'?bookings.length:bookings.filter(b=>b.status===f).length})
                    </button>
                  ))}
                </div>

                {shown.length===0 && <div style={{textAlign:'center',padding:'60px 0',color:'rgba(255,255,255,0.3)'}}>No {filter==='all'?'':filter} bookings</div>}

                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {shown.map(b=>{
                    const isOpen = expanded===b.id
                    return (
                      <div key={b.id} style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${STATUS_COLOR[b.status]}33`,borderRadius:16,overflow:'hidden'}}>
                        {/* Summary row */}
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'18px 20px',gap:12,flexWrap:'wrap',cursor:'pointer'}} onClick={()=>setExpanded(isOpen?null:b.id)}>
                          <div style={{minWidth:0}}>
                            <div style={{fontWeight:800,fontSize:16,color:'#fff',marginBottom:2}}>{b.name}</div>
                            <div style={{fontSize:13,color:'rgba(255,255,255,0.4)'}}>{b.email}{b.phone&&` · ${b.phone}`}</div>
                          </div>
                          <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                            <span style={{fontSize:14,fontWeight:700,color:'rgba(255,255,255,0.75)'}}>
                              {b.event_date?new Date(b.event_date+'T12:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'No date'}
                            </span>
                            <span style={{background:`${STATUS_COLOR[b.status]}22`,color:STATUS_COLOR[b.status],border:`1px solid ${STATUS_COLOR[b.status]}44`,padding:'3px 12px',borderRadius:12,fontSize:12,fontWeight:700,textTransform:'uppercase'}}>{b.status}</span>
                            <span style={{color:'rgba(255,255,255,0.3)',fontSize:18}}>{isOpen?'▲':'▼'}</span>
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {isOpen && (
                          <div style={{borderTop:'1px solid rgba(255,255,255,0.06)',padding:'20px'}}>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:10,marginBottom:16}}>
                              {[
                                ['🎪 Event Type', b.event_type||'—'],
                                ['📅 Date',       b.event_date?new Date(b.event_date+'T12:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'}):'—'],
                                ['🕐 Time',       b.event_time||'—'],
                                ['📍 Location',   b.event_location||'—'],
                                ['👥 Guests',     b.num_guests||'—'],
                                ['🍽 Food Type',  b.food_type||'—'],
                                ['🚐 Pref. Van',  b.preferred_van||'Any'],
                                ['📆 Submitted',  b.created_at?new Date(b.created_at).toLocaleDateString('en-GB'):'—'],
                              ].map(([k,v])=>(
                                <div key={k as string} style={{background:'rgba(255,255,255,0.03)',borderRadius:10,padding:'10px 12px'}}>
                                  <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginBottom:3}}>{k}</div>
                                  <div style={{fontSize:13,color:'rgba(255,255,255,0.8)',fontWeight:600}}>{v}</div>
                                </div>
                              ))}
                            </div>

                            {b.notes && (
                              <div style={{background:'rgba(255,255,255,0.03)',borderRadius:10,padding:'12px 14px',marginBottom:14,fontSize:13,color:'rgba(255,255,255,0.55)',lineHeight:1.6}}>
                                💬 <strong>Customer notes:</strong> {b.notes}
                              </div>
                            )}

                            {/* Admin notes */}
                            <div style={{marginBottom:16}}>
                              <label style={{display:'block',fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:6}}>📝 Admin Notes (internal only)</label>
                              <div style={{display:'flex',gap:8}}>
                                <textarea
                                  value={adminNotes[b.id]??b.admin_notes??''}
                                  onChange={e=>setAdminNotes(n=>({...n,[b.id]:e.target.value}))}
                                  style={{flex:1,...inp,minHeight:70,resize:'vertical',fontSize:13}}
                                  placeholder="Add internal notes, van assigned details, follow-up actions…"
                                />
                                <button onClick={()=>saveNotes(b.id)} style={{padding:'10px 16px',borderRadius:10,border:'none',background:'#6366f1',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',flexShrink:0,alignSelf:'flex-end'}}>Save</button>
                              </div>
                            </div>

                            {/* Status + delete actions */}
                            <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                              {b.status!=='accepted' && <button onClick={()=>updateStatus(b.id,'accepted')} style={{padding:'9px 18px',borderRadius:10,border:'none',background:'#10b981',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer'}}>✓ Accept</button>}
                              {b.status!=='pending'  && <button onClick={()=>updateStatus(b.id,'pending')}  style={{padding:'9px 18px',borderRadius:10,border:'none',background:'#f59e0b',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer'}}>⏳ Pending</button>}
                              {b.status!=='declined' && <button onClick={()=>updateStatus(b.id,'declined')} style={{padding:'9px 18px',borderRadius:10,border:'1px solid rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.15)',color:'#f87171',fontWeight:700,fontSize:13,cursor:'pointer'}}>✗ Decline</button>}
                              <button onClick={()=>deleteBooking(b.id)} style={{padding:'9px 18px',borderRadius:10,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(255,255,255,0.35)',fontWeight:700,fontSize:13,cursor:'pointer',marginLeft:'auto'}}>🗑 Delete</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* ── Block dates tab ── */}
            {!loading && tab==='calendar' && (
              <div style={{maxWidth:540}}>
                <h2 style={{fontSize:17,fontWeight:700,color:'#fff',margin:'0 0 16px'}}>Block Unavailable Dates</h2>
                <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
                  <input type="date" value={newBlock} onChange={e=>setNewBlock(e.target.value)} style={{...inp,flex:'0 0 auto'}} />
                  <input placeholder="Reason (optional)" value={blockReason} onChange={e=>setBlockReason(e.target.value)} style={{...inp,flex:1,minWidth:140}} />
                  <button onClick={blockDate} disabled={!newBlock} style={{padding:'10px 20px',borderRadius:10,border:'none',background:newBlock?'#f97316':'rgba(249,115,22,0.3)',color:'#fff',fontWeight:700,cursor:newBlock?'pointer':'not-allowed',fontSize:14}}>Block</button>
                </div>
                {blocked.length===0 && <p style={{color:'rgba(255,255,255,0.35)',fontSize:14}}>No blocked dates.</p>}
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {blocked.map(b=>(
                    <div key={b.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.18)',borderRadius:12,padding:'12px 16px'}}>
                      <div>
                        <div style={{fontSize:14,fontWeight:700,color:'#fff'}}>{new Date(b.blocked_date+'T12:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'long',year:'numeric'})}</div>
                        {b.reason&&<div style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginTop:2}}>{b.reason}</div>}
                      </div>
                      <button onClick={()=>unblockDate(b.blocked_date)} style={{padding:'6px 14px',borderRadius:8,border:'1px solid rgba(255,255,255,0.12)',background:'transparent',color:'rgba(255,255,255,0.5)',fontSize:12,cursor:'pointer'}}>Unblock</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  )
}
