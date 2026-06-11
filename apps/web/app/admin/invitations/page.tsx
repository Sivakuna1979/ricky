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

const METHOD_LABEL: Record<string, string> = {
  whatsapp:  '💬 WhatsApp',
  sms:       '📱 SMS',
  email:     '✉️ Email',
  copy_link: '🔗 Link Copied',
  manual:    '✓ Marked',
}

type Invite = {
  id: string; name: string; address: string; phone: string; website: string
  business_type: string; rating: number; invitation_sent_at: string; notes: string; google_place_id: string
}

export default function AdminInvitationsPage() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkIdx, setBulkIdx]   = useState(0)
  const [bulkRunning, setBulkRunning] = useState(false)

  useEffect(() => {
    fetch('/api/places/invite')
      .then(r=>r.json())
      .then(d=>{ setInvites(d.invitations??[]); setLoading(false) })
      .catch(()=>setLoading(false))
  }, [])

  const toggle = (id:string) => setSelected(prev=>{
    const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n
  })
  const toggleAll = () => setSelected(prev => prev.size===invites.length ? new Set() : new Set(invites.map(i=>i.id)))

  // Bulk invite: pop WhatsApp links one by one with 1s delay
  const bulkInvite = async () => {
    setBulkRunning(true)
    const targets = invites.filter(i=>selected.has(i.id))
    for (let idx=0; idx<targets.length; idx++) {
      const t = targets[idx]
      setBulkIdx(idx+1)
      const msg = `Hi ${t.name}, we found your food business on FoodTaxi! Customers near you are already discovering your listing. Claim your free profile here: https://food-taxi.vercel.app/claim/${t.google_place_id}\n\nAdd your menu, enable live GPS tracking, accept online orders and event bookings — completely free!`
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
      await new Promise(r=>setTimeout(r,1500))
    }
    setBulkRunning(false); setSelected(new Set())
  }

  const reInvite = (inv: Invite) => {
    const msg = `Hi ${inv.name}, we found your food business on FoodTaxi! Customers near you are already discovering your listing. Claim your free profile here: https://food-taxi.vercel.app/claim/${inv.google_place_id}\n\nAdd your menu, enable live GPS tracking, accept online orders and event bookings — completely free!`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

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
              <Link key={n.href} href={n.href} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, marginBottom:4, textDecoration:'none', background:n.href==='/admin/invitations'?'rgba(249,115,22,0.15)':'transparent', color:n.href==='/admin/invitations'?'#f97316':'rgba(255,255,255,0.6)', fontWeight:n.href==='/admin/invitations'?700:400, fontSize:14 }}>
                {n.icon} {n.label}
              </Link>
            ))}
          </nav>

          {/* Main */}
          <main style={{ flex:1, padding:24, overflowX:'hidden' }}>
            <h1 style={{ fontSize:24, fontWeight:800, margin:'0 0 4px' }}>📨 Business Invitations</h1>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.35)', margin:'0 0 24px' }}>Businesses discovered on Google Maps that have been invited to join FoodTaxi</p>

            {/* Bulk actions */}
            {selected.size>0 && (
              <div style={{ background:'rgba(5,150,105,0.1)', border:'1px solid rgba(5,150,105,0.25)', borderRadius:14, padding:'14px 18px', marginBottom:20, display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                <span style={{ fontSize:14, fontWeight:700, color:'#6ee7b7' }}>{selected.size} selected</span>
                <button onClick={bulkInvite} disabled={bulkRunning} style={{ padding:'9px 20px', borderRadius:10, border:'none', background:'#25d366', color:'#fff', fontWeight:700, fontSize:13, cursor:bulkRunning?'wait':'pointer' }}>
                  {bulkRunning ? `Sending ${bulkIdx}/${selected.size}…` : `💬 Bulk WhatsApp Invite (${selected.size})`}
                </button>
                <button onClick={()=>setSelected(new Set())} style={{ padding:'9px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,0.15)', background:'transparent', color:'rgba(255,255,255,0.5)', fontSize:13, cursor:'pointer' }}>Clear</button>
              </div>
            )}

            {loading && <div style={{ color:'rgba(255,255,255,0.4)', padding:'40px 0', textAlign:'center' }}>Loading…</div>}
            {!loading && invites.length===0 && (
              <div style={{ textAlign:'center', padding:'60px 20px' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📭</div>
                <div style={{ fontSize:16, color:'rgba(255,255,255,0.4)' }}>No invitations sent yet</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.25)', marginTop:8 }}>Use the "Invite" button on any Google food business card on the search map to get started.</div>
                <Link href="/search" style={{ display:'inline-block', marginTop:20, padding:'11px 24px', borderRadius:12, background:'linear-gradient(135deg,#f97316,#ea580c)', color:'#fff', fontWeight:700, fontSize:14, textDecoration:'none' }}>Go to Map →</Link>
              </div>
            )}

            {!loading && invites.length>0 && (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                  <input type="checkbox" checked={selected.size===invites.length} onChange={toggleAll} style={{ width:16, height:16, accentColor:'#f97316', cursor:'pointer' }} />
                  <span style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>Select all ({invites.length})</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {invites.map(inv => {
                    const methodMatch = (inv.notes??'').match(/Invited via (\w+)/)
                    const method = methodMatch?.[1] ?? 'manual'
                    const dateStr = inv.invitation_sent_at ? new Date(inv.invitation_sent_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'
                    return (
                      <div key={inv.id} style={{ background:'rgba(255,255,255,0.04)', border:`1px solid ${selected.has(inv.id)?'rgba(249,115,22,0.4)':'rgba(255,255,255,0.08)'}`, borderRadius:14, padding:'16px 18px', display:'flex', gap:14, alignItems:'flex-start' }}>
                        <input type="checkbox" checked={selected.has(inv.id)} onChange={()=>toggle(inv.id)} style={{ width:16, height:16, accentColor:'#f97316', cursor:'pointer', marginTop:2, flexShrink:0 }} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
                            <div style={{ fontWeight:800, fontSize:15, color:'#fff' }}>{inv.name}</div>
                            <span style={{ background:'rgba(5,150,105,0.15)', color:'#6ee7b7', border:'1px solid rgba(5,150,105,0.25)', padding:'3px 10px', borderRadius:10, fontSize:11, fontWeight:700, flexShrink:0 }}>INVITED</span>
                          </div>
                          {inv.address && <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginTop:4 }}>📍 {inv.address}</div>}
                          <div style={{ display:'flex', gap:16, marginTop:8, flexWrap:'wrap', fontSize:12, color:'rgba(255,255,255,0.35)' }}>
                            <span>📅 {dateStr}</span>
                            <span>{METHOD_LABEL[method]??method}</span>
                            {inv.rating && <span>⭐ {inv.rating}</span>}
                            {inv.business_type && <span style={{ textTransform:'capitalize' }}>{inv.business_type.replace('_',' ')}</span>}
                          </div>
                        </div>
                        <button onClick={()=>reInvite(inv)} style={{ padding:'8px 14px', borderRadius:10, border:'1px solid rgba(37,211,102,0.3)', background:'rgba(37,211,102,0.1)', color:'#6ee7b7', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
                          💬 Follow Up
                        </button>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </>
  )
}
