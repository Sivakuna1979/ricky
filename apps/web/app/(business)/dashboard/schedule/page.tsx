// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function SchedulePage() {
  const [vans, setVans]           = useState<any[]>([])
  const [vanId, setVanId]         = useState<string|null>(null)
  const [schedule, setSchedule]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [bizName, setBizName]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [editDay, setEditDay]     = useState<number|null>(null)
  const [form, setForm]           = useState({ location_name:'', arrival_time:'16:30', departure_time:'20:30', notes:'' })
  const [aiText, setAiText]       = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiPreview, setAiPreview] = useState<any[]|null>(null)
  const [aiError, setAiError]     = useState('')
  const [aiSaved, setAiSaved]     = useState(false)

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
      const { data: vanList } = await supabase.from('vans').select('id, name').eq('business_id', biz.id).order('name')
      if (!vanList?.length) { setLoading(false); return }
      setVans(vanList)
      const firstVan = vanList[0]
      setVanId(firstVan.id)
      const { data: sched } = await supabase.from('van_schedule').select('*').eq('van_id', firstVan.id).order('day_of_week').order('sort_order')
      setSchedule(sched ?? [])
      setLoading(false)
    })
  }, [])

  const switchVan = async (id: string) => {
    setVanId(id)
    setEditDay(null)
    setAiPreview(null)
    const supabase = createClient()
    const { data } = await supabase.from('van_schedule').select('*').eq('van_id', id).order('day_of_week').order('sort_order')
    setSchedule(data ?? [])
  }

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

  const parseWithAI = async () => {
    if (!aiText.trim()) return
    setAiLoading(true)
    setAiError('')
    setAiPreview(null)
    setAiSaved(false)
    try {
      const res = await fetch('/api/ai/parse-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText })
      })
      const data = await res.json()
      if (data.error) { setAiError(data.error); setAiLoading(false); return }
      setAiPreview(data.stops ?? [])
    } catch (e: any) {
      setAiError(e.message)
    }
    setAiLoading(false)
  }

  const saveAIStops = async () => {
    if (!aiPreview?.length || !vanId) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('van_schedule').insert(aiPreview.map(s => ({ van_id: vanId, ...s })))
    setAiPreview(null)
    setAiText('')
    setAiSaved(true)
    await refresh()
    setSaving(false)
    setTimeout(() => setAiSaved(false), 3000)
  }

  const removeAIPreviewStop = (idx: number) => {
    setAiPreview(prev => prev ? prev.filter((_, i) => i !== idx) : [])
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
  const todayIdx = (new Date().getDay() + 6) % 7

  return (
    <>
      <style>{`
        html,body{margin:0;padding:0}
        .wrap{display:flex;flex-direction:column;min-height:100vh;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        .topbar{background:#fff;border-bottom:1px solid #e5e7eb;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
        .sidebar{width:220px;flex-shrink:0;background:#fff;border-right:1px solid #e5e7eb;padding:16px 10px;min-height:calc(100vh - 56px)}
        .main{flex:1;padding:24px;max-width:840px}
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
            <p style={{ color:'#888', fontSize:13, margin:'0 0 20px' }}>Set your regular weekly stops — customers see this on your menu page</p>

            {loading ? <div style={{ color:'#888' }}>Loading…</div> : !vans.length ? (
              <div style={{ background:'#fff', borderRadius:14, padding:32, textAlign:'center' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🚐</div>
                <div style={{ fontWeight:700, marginBottom:12 }}>No van found</div>
                <a href="/dashboard/vans/new" style={{ padding:'10px 24px', background:'#f97316', color:'#fff', borderRadius:10, textDecoration:'none', fontWeight:700 }}>Add a Van First</a>
              </div>
            ) : (
              <>
                {/* Van selector */}
                {vans.length > 1 && (
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
                    {vans.map(v => (
                      <button key={v.id} onClick={() => switchVan(v.id)} style={{ padding:'8px 18px', borderRadius:20, border: vanId === v.id ? '2px solid #f97316' : '2px solid #e5e7eb', background: vanId === v.id ? '#fff7ed' : '#fff', color: vanId === v.id ? '#f97316' : '#555', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                        🚐 {v.name}
                      </button>
                    ))}
                  </div>
                )}
                {vans.length === 1 && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
                    <span style={{ fontSize:18 }}>🚐</span>
                    <span style={{ fontWeight:700, fontSize:15, color:'#111' }}>{vans[0].name}</span>
                  </div>
                )}

                {/* AI Schedule Helper */}
                <div style={{ background:'linear-gradient(135deg,#667eea,#764ba2)', borderRadius:14, padding:20, marginBottom:24, color:'#fff' }}>
                  <div style={{ fontWeight:800, fontSize:16, marginBottom:4 }}>✨ AI Schedule Helper</div>
                  <div style={{ fontSize:13, opacity:0.9, marginBottom:14 }}>Describe your week in plain English — AI will convert it to stops for you</div>
                  <textarea
                    value={aiText}
                    onChange={e => setAiText(e.target.value)}
                    placeholder={'e.g. Monday Pulborough 4:30-8:30pm, Tuesday Wisborough Green 5pm to 9pm, Wednesday off, Thursday Billingshurst 4:30-8:30pm'}
                    rows={3}
                    style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'none', fontSize:13, fontFamily:'inherit', outline:'none', resize:'vertical', boxSizing:'border-box', color:'#111', lineHeight:1.5 }}
                  />
                  <div style={{ display:'flex', gap:10, marginTop:10, alignItems:'center', flexWrap:'wrap' }}>
                    <button onClick={parseWithAI} disabled={aiLoading || !aiText.trim()} style={{ padding:'10px 22px', borderRadius:10, border:'none', background:'#fff', color:'#764ba2', fontWeight:800, fontSize:14, cursor:'pointer', opacity: aiLoading || !aiText.trim() ? 0.6 : 1 }}>
                      {aiLoading ? '⏳ Parsing…' : '✨ Parse Schedule'}
                    </button>
                    {aiSaved && <span style={{ fontSize:13, fontWeight:700, color:'#a7f3d0' }}>✅ Stops saved!</span>}
                    {aiError && <span style={{ fontSize:13, color:'#fca5a5' }}>Error: {aiError}</span>}
                  </div>

                  {/* AI Preview */}
                  {aiPreview && (
                    <div style={{ marginTop:16, background:'rgba(255,255,255,0.15)', borderRadius:12, padding:14 }}>
                      <div style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>Preview — {aiPreview.length} stop{aiPreview.length !== 1 ? 's' : ''} found</div>
                      {aiPreview.length === 0 ? (
                        <div style={{ fontSize:13, opacity:0.8 }}>No stops detected. Try rephrasing your schedule.</div>
                      ) : (
                        <>
                          {aiPreview.map((s, i) => (
                            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(255,255,255,0.1)', borderRadius:8, padding:'8px 10px', marginBottom:6 }}>
                              <div style={{ fontSize:12, fontWeight:700, background:'rgba(255,255,255,0.2)', borderRadius:6, padding:'2px 8px', minWidth:28, textAlign:'center' }}>{DAYS[s.day_of_week]?.slice(0,3)}</div>
                              <div style={{ flex:1, fontSize:13 }}>
                                <span style={{ fontWeight:700 }}>{s.location_name}</span>
                                <span style={{ opacity:0.8 }}> · {s.arrival_time} – {s.departure_time}</span>
                                {s.notes && <span style={{ opacity:0.7 }}> · {s.notes}</span>}
                              </div>
                              <button onClick={() => removeAIPreviewStop(i)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', fontSize:18, cursor:'pointer', padding:'0 2px', lineHeight:1 }}>×</button>
                            </div>
                          ))}
                          <button onClick={saveAIStops} disabled={saving || !aiPreview.length} style={{ marginTop:10, padding:'10px 24px', borderRadius:10, border:'none', background:'#10b981', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer' }}>
                            {saving ? 'Saving…' : `Save ${aiPreview.length} Stop${aiPreview.length !== 1 ? 's' : ''} →`}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Weekly schedule */}
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {[0,1,2,3,4,5,6].map(day => {
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
                            <input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Notes (optional)" style={inp} />
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
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
