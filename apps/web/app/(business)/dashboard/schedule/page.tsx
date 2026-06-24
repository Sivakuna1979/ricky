// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function SchedulePage() {
  const [vanId, setVanId]       = useState<string|null>(null)
  const [vanName, setVanName]   = useState('')
  const [schedule, setSchedule] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [bizName, setBizName]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [editDay, setEditDay]   = useState<number|null>(null)
  const [form, setForm]         = useState({ location_name:'', arrival_time:'16:30', departure_time:'20:30', notes:'' })

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/login'; return }
      const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      let biz: any = null
      if (userData?.id) {
        const { data: b } = await supabase.from('businesses').select('id, name').eq('owner_id', userData.id).maybeSingle()
        biz = b
      }
      if (!biz) { const { data: r } = await supabase.rpc('get_my_business'); if (r) biz = r }
      if (!biz) { window.location.href = '/register/business'; return }
      setBizName(biz.name ?? '')
      const { data: vans } = await supabase.from('vans').select('id, name').eq('business_id', biz.id).limit(1)
      const van = vans?.[0]
      if (!van) { setLoading(false); return }
      setVanId(van.id)
      setVanName(van.name)
      const { data: sched } = await supabase.from('van_schedule').select('*').eq('van_id', van.id).order('day_of_week').order('sort_order')
      setSchedule(sched ?? [])
      setLoading(false)
    })
  }, [])

  const refresh = async () => {
    if (!vanId) return
    const supabase = createClient()
    const { data } = await supabase.from('van_schedule').select('*').eq('van_id', vanId).order('day_of_week').order('sort_order')
    setSchedule(data ?? [])
  }

  const addStop = async (day: number) => {
    if (!form.location_name || !vanId) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('van_schedule').insert({ van_id: vanId, day_of_week: day, ...form })
    setForm({ location_name:'', arrival_time:'16:30', departure_time:'20:30', notes:'' })
    setEditDay(null)
    await refresh()
    setSaving(false)
  }

  const deleteStop = async (id: string) => {
    const supabase = createClient()
    await supabase.from('van_schedule').delete().eq('id', id)
    await refresh()
  }

  const NAV = [
    { icon: '📊', label: 'Dashboard', href: '/dashboard' },
    { icon: '🚐', label: 'My Vans',   href: '/dashboard/vans' },
    { icon: '📦', label: 'Orders',    href: '/dashboard/orders' },
    { icon: '📋', label: 'Menu',      href: '/dashboard/menu' },
    { icon: '🗓️', label: 'Schedule',  href: '/dashboard/schedule', active: true },
    { icon: '💳', label: 'My Plan',   href: '/dashboard/billing' },
    { icon: '⚙️', label: 'Settings',  href: '/dashboard/settings' },
  ]

  const inp = { width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:14, outline:'none', boxSizing:'border-box' as const, fontFamily:'inherit' }

  const todayIdx = (new Date().getDay() + 6) % 7 // Mon=0

  return (
    <>
      <style>{`
        html,body{margin:0;padding:0}
        .wrap{display:flex;flex-direction:column;min-height:100vh;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        .topbar{background:#fff;border-bottom:1px solid #e5e7eb;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
        .sidebar{width:220px;flex-shrink:0;background:#fff;border-right:1px solid #e5e7eb;padding:16px 10px;min-height:calc(100vh - 56px)}
        .main{flex:1;padding:24px;max-width:800px}
        .body{display:flex;flex:1}
        @media(max-width:700px){.sidebar{display:none}.main{padding:16px 14px 90px}}
      `}</style>
      <div className="wrap">
        <div className="topbar">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#f97316,#dc2626)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:'#fff' }}>FT</div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#111', lineHeight:1 }}>FoodTaxi</div>
              {bizName && <div style={{ fontSize:11, color:'#888' }}>{bizName}</div>}
            </div>
          </div>
          <a href="/" style={{ fontSize:12, color:'#6366f1', textDecoration:'none', padding:'5px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontWeight:600 }}>← Public Site</a>
        </div>
        <div className="body">
          <div className="sidebar">
            {NAV.map(n => (
              <a key={n.href} href={n.href} style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:10, marginBottom:3, fontSize:14, fontWeight:600, textDecoration:'none', color: n.active ? '#f97316' : '#555', background: n.active ? '#fff7ed' : 'transparent', border: n.active ? '1px solid #fed7aa' : '1px solid transparent' }}>
                <span style={{ fontSize:16 }}>{n.icon}</span>{n.label}
              </a>
            ))}
          </div>
          <div className="main">
            <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#111' }}>Weekly Schedule</h1>
            <p style={{ color:'#888', fontSize:13, margin:'0 0 24px' }}>Set your regular weekly stops — customers see this on your menu page</p>

            {loading ? <div style={{ color:'#888' }}>Loading…</div> : !vanId ? (
              <div style={{ background:'#fff', borderRadius:14, padding:32, textAlign:'center' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🚐</div>
                <div style={{ fontWeight:700, marginBottom:12 }}>No van found</div>
                <a href="/dashboard/vans/new" style={{ padding:'10px 24px', background:'#f97316', color:'#fff', borderRadius:10, textDecoration:'none', fontWeight:700 }}>Add a Van First</a>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {[0,1,2,3,4,5].map(day => {
                  const dayStops = schedule.filter(s => s.day_of_week === day)
                  const isToday = day === todayIdx
                  return (
                    <div key={day} style={{ background:'#fff', borderRadius:14, padding:16, boxShadow:'0 1px 3px rgba(0,0,0,0.07)', border: isToday ? '2px solid #f97316' : '2px solid transparent' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: dayStops.length > 0 || editDay === day ? 12 : 0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ fontWeight:800, fontSize:15, color: isToday ? '#f97316' : '#111' }}>{DAYS[day]}</div>
                          {isToday && <span style={{ background:'#f97316', color:'#fff', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:8 }}>TODAY</span>}
                        </div>
                        <button onClick={() => setEditDay(editDay === day ? null : day)} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #e5e7eb', background:'#f9fafb', fontSize:13, fontWeight:600, cursor:'pointer', color:'#555' }}>
                          {editDay === day ? 'Cancel' : '+ Add Stop'}
                        </button>
                      </div>

                      {dayStops.map(stop => (
                        <div key={stop.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'#f9fafb', borderRadius:8, marginBottom:6 }}>
                          <div style={{ fontSize:16 }}>📍</div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:700, fontSize:14, color:'#111' }}>{stop.location_name}</div>
                            <div style={{ fontSize:12, color:'#888' }}>{stop.arrival_time} – {stop.departure_time}{stop.notes ? ` · ${stop.notes}` : ''}</div>
                          </div>
                          <button onClick={() => deleteStop(stop.id)} style={{ background:'none', border:'none', color:'#ef4444', fontSize:18, cursor:'pointer', padding:'0 4px' }}>×</button>
                        </div>
                      ))}

                      {editDay === day && (
                        <div style={{ background:'#f9fafb', borderRadius:10, padding:14, marginTop:8, display:'flex', flexDirection:'column', gap:10 }}>
                          <input value={form.location_name} onChange={e => setForm(f => ({...f, location_name: e.target.value}))} placeholder="Location (e.g. Pulborough)" style={inp} />
                          <div style={{ display:'flex', gap:8 }}>
                            <div style={{ flex:1 }}>
                              <label style={{ fontSize:11, fontWeight:700, color:'#888', display:'block', marginBottom:4 }}>Arrival</label>
                              <input type="time" value={form.arrival_time} onChange={e => setForm(f => ({...f, arrival_time: e.target.value}))} style={inp} />
                            </div>
                            <div style={{ flex:1 }}>
                              <label style={{ fontSize:11, fontWeight:700, color:'#888', display:'block', marginBottom:4 }}>Departure</label>
                              <input type="time" value={form.departure_time} onChange={e => setForm(f => ({...f, departure_time: e.target.value}))} style={inp} />
                            </div>
                          </div>
                          <input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Notes (optional, e.g. 'from 6:45 PM')" style={inp} />
                          <button onClick={() => addStop(day)} disabled={saving || !form.location_name} style={{ padding:'10px', borderRadius:8, border:'none', background:'#f97316', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                            {saving ? 'Saving…' : '+ Add Stop'}
                          </button>
                        </div>
                      )}

                      {dayStops.length === 0 && editDay !== day && (
                        <div style={{ fontSize:13, color:'#ccc', fontStyle:'italic' }}>No stops — tap Add Stop to set your location</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
