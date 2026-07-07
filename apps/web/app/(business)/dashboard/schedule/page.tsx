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
  const [editingStop, setEditingStop] = useState(null)   // stop id being edited
  const [editForm, setEditForm]   = useState({ day_of_week:0, location_name:'', arrival_time:'16:30', departure_time:'20:30', notes:'' })
  const [aiText, setAiText]       = useState('')
  const [aiImage, setAiImage]     = useState<{data:string,mediaType:string,preview:string}|null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiPreview, setAiPreview] = useState<any[]|null>(null)
  const [aiError, setAiError]     = useState('')
  const [aiSaved, setAiSaved]     = useState(false)
  const [aiTab, setAiTab]         = useState<'text'|'image'>('text')

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
      const { data: sched } = await supabase.from('van_schedule').select('*').eq('van_id', firstVan.id).order('day_of_week').order('arrival_time')
      setSchedule(sched ?? [])
      setLoading(false)
    })
  }, [])

  const switchVan = async (id: string) => {
    setVanId(id)
    setEditDay(null)
    setAiPreview(null)
    const supabase = createClient()
    const { data } = await supabase.from('van_schedule').select('*').eq('van_id', id).order('day_of_week').order('arrival_time')
    setSchedule(data ?? [])
  }

  const refresh = async () => {
    if (!vanId) return
    const supabase = createClient()
    const { data } = await supabase.from('van_schedule').select('*').eq('van_id', vanId).order('day_of_week').order('arrival_time')
    setSchedule(data ?? [])
  }

  const addStop = async (day: number) => {
    if (!form.location_name || !vanId) return
    setSaving(true)
    const res = await fetch('/api/schedule/stops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ van_id: vanId, stops: [{ day_of_week: day, ...form }] }),
    })
    const data = await res.json()
    if (!res.ok || data.error) { alert(`Could not save: ${data.error ?? 'Unknown error'}`); setSaving(false); return }
    setForm({ location_name:'', arrival_time:'16:30', departure_time:'20:30', notes:'' })
    setEditDay(null)
    await refresh()
    setSaving(false)
  }

  const startEditStop = (stop: any) => {
    setEditingStop(stop.id)
    setEditForm({ day_of_week: stop.day_of_week, location_name: stop.location_name, arrival_time: stop.arrival_time, departure_time: stop.departure_time, notes: stop.notes ?? '' })
  }

  const updateStop = async () => {
    if (!editingStop || !editForm.location_name) return
    setSaving(true)
    const res = await fetch('/api/schedule/stops', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingStop, ...editForm }),
    })
    const data = await res.json()
    if (!res.ok || data.error) { alert(`Could not update: ${data.error ?? 'Unknown error'}`); setSaving(false); return }
    setEditingStop(null)
    await refresh()
    setSaving(false)
  }

  const deleteStop = async (id: string) => {
    await fetch('/api/schedule/stops', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await refresh()
  }

  const handleImagePick = (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      const [meta, data] = dataUrl.split(',')
      const mediaType = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
      setAiImage({ data, mediaType, preview: dataUrl })
      setAiError('')
      setAiPreview(null)
    }
    reader.readAsDataURL(file)
  }

  const parseWithAI = async () => {
    const hasImage = aiTab === 'image' && aiImage
    const hasText = aiTab === 'text' && aiText.trim()
    if (!hasImage && !hasText) return
    setAiLoading(true)
    setAiError('')
    setAiPreview(null)
    setAiSaved(false)
    try {
      const body = hasImage
        ? { image: { data: aiImage.data, mediaType: aiImage.mediaType } }
        : { text: aiText }
      const res = await fetch('/api/ai/parse-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) { setAiError(data.error); setAiLoading(false); return }
      // Mark stops where AI couldn't determine the day
      const stops = (data.stops ?? []).map((s: any) => ({
        ...s,
        day_unset: s.day_of_week == null || s.day_of_week === -1,
        day_of_week: s.day_of_week ?? null,
      }))
      setAiPreview(stops)
    } catch (e: any) {
      setAiError(e.message)
    }
    setAiLoading(false)
  }

  const saveAIStops = async () => {
    if (!aiPreview?.length || !vanId) return
    setSaving(true)
    setAiError('')
    const stops = aiPreview.map(({ day_unset, ...s }) => s)
    const res = await fetch('/api/schedule/stops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ van_id: vanId, stops }),
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      setAiError(`Save failed: ${data.error ?? 'Unknown error'}`)
      setSaving(false)
      return
    }
    setAiPreview(null)
    setAiText('')
    setAiImage(null)
    setAiSaved(true)
    await refresh()
    setSaving(false)
    setTimeout(() => setAiSaved(false), 4000)
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
  { icon: '💬', label: 'WhatsApp',  href: '/dashboard/whatsapp' },
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
                  <div style={{ fontSize:13, opacity:0.9, marginBottom:14 }}>Type your schedule or upload a photo — AI reads it and builds your stops</div>

                  {/* Tabs */}
                  <div style={{ display:'flex', gap:6, marginBottom:14 }}>
                    <button onClick={() => { setAiTab('text'); setAiError(''); setAiPreview(null) }}
                      style={{ flex:1, padding:'8px', borderRadius:10, border:'none', fontWeight:800, fontSize:13, cursor:'pointer', background: aiTab === 'text' ? '#fff' : 'rgba(255,255,255,0.15)', color: aiTab === 'text' ? '#764ba2' : '#fff' }}>
                      ⌨️ Type Schedule
                    </button>
                    <button onClick={() => { setAiTab('image'); setAiError(''); setAiPreview(null) }}
                      style={{ flex:1, padding:'8px', borderRadius:10, border:'none', fontWeight:800, fontSize:13, cursor:'pointer', background: aiTab === 'image' ? '#fff' : 'rgba(255,255,255,0.15)', color: aiTab === 'image' ? '#764ba2' : '#fff' }}>
                      📷 Upload Photo
                    </button>
                  </div>

                  {aiTab === 'text' ? (
                    <textarea
                      value={aiText}
                      onChange={e => setAiText(e.target.value)}
                      placeholder="e.g. Monday Pulborough 4:30-8:30pm, Tuesday Wisborough Green 5pm to 9pm, Thursday Billingshurst 4:30-8:30pm"
                      rows={3}
                      style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'none', fontSize:13, fontFamily:'inherit', outline:'none', resize:'vertical', boxSizing:'border-box', color:'#111', lineHeight:1.5 }}
                    />
                  ) : (
                    <div>
                      {aiImage && (
                        <div style={{ marginBottom:10 }}>
                          <img src={aiImage.preview} alt="schedule" style={{ width:'100%', borderRadius:10, maxHeight:220, objectFit:'cover', display:'block' }} />
                        </div>
                      )}
                      <div style={{ display:'flex', gap:8 }}>
                        <label style={{ flex:1, cursor:'pointer' }}>
                          <input type="file" accept="image/*" capture="camera" onChange={handleImagePick} style={{ display:'none' }} />
                          <div style={{ padding:'14px 8px', borderRadius:12, border:'2px solid rgba(255,255,255,0.5)', textAlign:'center', background:'rgba(255,255,255,0.12)' }}>
                            <div style={{ fontSize:30, marginBottom:4 }}>📷</div>
                            <div style={{ fontSize:13, fontWeight:800 }}>Camera</div>
                            <div style={{ fontSize:11, opacity:0.8, marginTop:2 }}>Take a photo now</div>
                          </div>
                        </label>
                        <label style={{ flex:1, cursor:'pointer' }}>
                          <input type="file" accept="image/jpeg,image/png,image/heic,image/*" onChange={handleImagePick} style={{ display:'none' }} />
                          <div style={{ padding:'14px 8px', borderRadius:12, border:'2px solid rgba(255,255,255,0.5)', textAlign:'center', background:'rgba(255,255,255,0.12)' }}>
                            <div style={{ fontSize:30, marginBottom:4 }}>🖼️</div>
                            <div style={{ fontSize:13, fontWeight:800 }}>Gallery</div>
                            <div style={{ fontSize:11, opacity:0.8, marginTop:2 }}>Pick from photos</div>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  <div style={{ display:'flex', gap:10, marginTop:12, alignItems:'center', flexWrap:'wrap' }}>
                    <button onClick={parseWithAI}
                      disabled={aiLoading || (aiTab === 'text' ? !aiText.trim() : !aiImage)}
                      style={{ padding:'10px 22px', borderRadius:10, border:'none', background:'#fff', color:'#764ba2', fontWeight:800, fontSize:14, cursor:'pointer',
                        opacity: (aiLoading || (aiTab === 'text' ? !aiText.trim() : !aiImage)) ? 0.5 : 1 }}>
                      {aiLoading ? '⏳ Reading…' : aiTab === 'image' ? '🔍 Scan & Parse' : '✨ Parse Schedule'}
                    </button>
                    {aiSaved && <span style={{ fontSize:13, fontWeight:700, color:'#a7f3d0' }}>✅ Stops saved!</span>}
                    {aiError && (
                      <div style={{ width:'100%', marginTop:8, background:'rgba(239,68,68,0.2)', border:'1px solid rgba(239,68,68,0.4)', borderRadius:10, padding:'10px 14px' }}>
                        <div style={{ fontSize:13, color:'#fca5a5', fontWeight:700, marginBottom:6 }}>⚠️ {aiError}</div>
                        {(aiError.includes('permission') || aiError.includes('does not exist') || aiError.includes('Load failed')) && (
                          <div>
                            <div style={{ fontSize:12, color:'#fca5a5', marginBottom:8, opacity:0.9 }}>The schedule table needs to be set up in your database. Tap below to open Supabase and run the setup SQL.</div>
                            <a href="https://app.supabase.com/project/fzrridbzelijulofgzxo/sql/new" target="_blank" rel="noopener noreferrer"
                              style={{ display:'inline-block', padding:'8px 16px', background:'#fff', color:'#764ba2', borderRadius:8, fontWeight:800, fontSize:13, textDecoration:'none' }}>
                              🔧 Open Supabase SQL Editor →
                            </a>
                            <div style={{ marginTop:10, background:'rgba(0,0,0,0.3)', borderRadius:8, padding:'10px 12px' }}>
                              <div style={{ fontSize:11, color:'#d1d5db', marginBottom:6, fontWeight:700 }}>PASTE THIS SQL AND CLICK RUN:</div>
                              <pre style={{ fontSize:10, color:'#e5e7eb', margin:0, whiteSpace:'pre-wrap', fontFamily:'monospace', lineHeight:1.5 }}>{`create table if not exists van_schedule (
  id uuid primary key default gen_random_uuid(),
  van_id uuid references vans(id) on delete cascade,
  day_of_week integer not null,
  location_name text not null,
  arrival_time text not null,
  departure_time text not null,
  notes text default '',
  sort_order integer default 0,
  created_at timestamptz default now()
);
alter table van_schedule enable row level security;
drop policy if exists "public_all" on van_schedule;
drop policy if exists "auth_all" on van_schedule;
drop policy if exists "public_read" on van_schedule;
create policy "van_schedule_super_admin" on van_schedule for all using (is_super_admin());
create policy "van_schedule_owner_all" on van_schedule for all using (van_id in (select my_van_ids())) with check (van_id in (select my_van_ids()));
create policy "van_schedule_public_read" on van_schedule for select using (true);
grant select on van_schedule to anon;
grant select, insert, update, delete on van_schedule to authenticated;`}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* AI Preview */}
                  {aiPreview && (
                    <div style={{ marginTop:16, background:'rgba(255,255,255,0.15)', borderRadius:12, padding:14 }}>
                      <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>
                        {aiPreview.length === 0 ? 'No stops found' : `${aiPreview.length} stop${aiPreview.length !== 1 ? 's' : ''} found — check days & times then save`}
                      </div>
                      {aiPreview.length === 0 ? (
                        <div style={{ fontSize:13, opacity:0.8, marginTop:6 }}>Could not read the schedule. Try a clearer photo or type it in.</div>
                      ) : (
                        <>
                          {/* Apply day to all stops at once */}
                          <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'12px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:10 }}>
                            <div style={{ fontSize:13, fontWeight:800, flex:1 }}>📅 Set day for all stops:</div>
                            <select
                              defaultValue=""
                              onChange={e => {
                                if (!e.target.value) return
                                const day = Number(e.target.value)
                                setAiPreview(prev => prev ? prev.map(x => ({...x, day_of_week: day, day_unset: false})) : prev)
                              }}
                              style={{ padding:'7px 10px', borderRadius:8, border:'none', background:'#fff', color:'#764ba2', fontWeight:800, fontSize:13, cursor:'pointer' }}>
                              <option value="">Pick a day…</option>
                              {DAYS.map((d,idx) => <option key={idx} value={idx}>{d}</option>)}
                            </select>
                          </div>

                          {aiPreview.some((s: any) => s.day_of_week == null) && (
                            <div style={{ background:'rgba(251,191,36,0.25)', border:'1px solid rgba(251,191,36,0.5)', borderRadius:8, padding:'8px 12px', fontSize:12, fontWeight:700, color:'#fef08a', marginBottom:10 }}>
                              ⚠️ Or pick a day individually for each stop below
                            </div>
                          )}
                          {aiPreview.map((s: any, i: number) => {
                            const needsDay = s.day_of_week == null
                            return (
                              <div key={i} style={{ background: needsDay ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.12)', border: needsDay ? '1px solid rgba(251,191,36,0.4)' : '1px solid transparent', borderRadius:10, padding:'10px 12px', marginBottom:8 }}>
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                                  <select
                                    value={s.day_of_week ?? ''}
                                    onChange={e => setAiPreview(prev => prev ? prev.map((x,j) => j===i ? {...x, day_of_week: Number(e.target.value), day_unset: false} : x) : prev)}
                                    style={{ padding:'6px 10px', borderRadius:7, border: needsDay ? '2px solid #fbbf24' : 'none', background:'rgba(255,255,255,0.95)', color: needsDay ? '#b45309' : '#764ba2', fontWeight:800, fontSize:13, cursor:'pointer' }}>
                                    {needsDay && <option value="" disabled>📅 Pick a day…</option>}
                                    {DAYS.map((d,idx) => <option key={idx} value={idx}>{d}</option>)}
                                  </select>
                                  <button onClick={() => removeAIPreviewStop(i)} style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', fontSize:13, cursor:'pointer', borderRadius:6, padding:'4px 10px', fontWeight:700 }}>Remove</button>
                                </div>
                                <input
                                  value={s.location_name}
                                  onChange={e => setAiPreview(prev => prev ? prev.map((x,j) => j===i ? {...x, location_name: e.target.value} : x) : prev)}
                                  placeholder="Location name"
                                  style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'none', background:'rgba(255,255,255,0.9)', color:'#111', fontSize:13, fontWeight:700, boxSizing:'border-box', marginBottom:6 }}
                                />
                                <div style={{ display:'flex', gap:6 }}>
                                  <input type="time" value={s.arrival_time ?? '16:30'}
                                    onChange={e => setAiPreview(prev => prev ? prev.map((x,j) => j===i ? {...x, arrival_time: e.target.value} : x) : prev)}
                                    style={{ flex:1, padding:'7px 8px', borderRadius:7, border:'none', background:'rgba(255,255,255,0.9)', color:'#111', fontSize:13 }} />
                                  <span style={{ alignSelf:'center', opacity:0.8, fontSize:12 }}>to</span>
                                  <input type="time" value={s.departure_time ?? '20:30'}
                                    onChange={e => setAiPreview(prev => prev ? prev.map((x,j) => j===i ? {...x, departure_time: e.target.value} : x) : prev)}
                                    style={{ flex:1, padding:'7px 8px', borderRadius:7, border:'none', background:'rgba(255,255,255,0.9)', color:'#111', fontSize:13 }} />
                                </div>
                              </div>
                            )
                          })}
                          {(() => {
                            const unset = aiPreview.filter((s: any) => s.day_of_week == null).length
                            return (
                              <button onClick={saveAIStops} disabled={saving || unset > 0}
                                style={{ marginTop:6, width:'100%', padding:'12px', borderRadius:10, border:'none', background: unset > 0 ? 'rgba(107,114,128,0.5)' : '#10b981', color:'#fff', fontWeight:800, fontSize:15, cursor: unset > 0 ? 'not-allowed' : 'pointer' }}>
                                {saving ? 'Saving…' : unset > 0 ? `⚠️ Pick day for ${unset} stop${unset!==1?'s':''}` : `✅ Save ${aiPreview.length} Stop${aiPreview.length!==1?'s':''} to Schedule`}
                              </button>
                            )
                          })()}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Weekly schedule */}
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {[0,1,2,3,4,5,6].map(day => {
                    const dayStops = schedule.filter(s => s.day_of_week === day).slice().sort((a, b) => String(a.arrival_time).localeCompare(String(b.arrival_time)))
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
                          editingStop === stop.id ? (
                            <div key={stop.id} style={{ background:'#fff7ed', border:'1px solid #fdba74', borderRadius:10, padding:12, marginBottom:6, display:'flex', flexDirection:'column', gap:8 }}>
                              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                                <span style={{ fontSize:11, fontWeight:700, color:'#888' }}>Day</span>
                                <select value={editForm.day_of_week} onChange={e => setEditForm(f => ({...f, day_of_week: Number(e.target.value)}))}
                                  style={{ ...inp, width:'auto', flex:1 }}>
                                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                                </select>
                              </div>
                              <input value={editForm.location_name} onChange={e => setEditForm(f => ({...f, location_name: e.target.value}))} placeholder="Location" style={inp} />
                              <div style={{ display:'flex', gap:8 }}>
                                <div style={{ flex:1 }}>
                                  <label style={{ fontSize:11, fontWeight:700, color:'#888', display:'block', marginBottom:4 }}>Arrival</label>
                                  <input type="time" value={editForm.arrival_time} onChange={e => setEditForm(f => ({...f, arrival_time: e.target.value}))} style={inp} />
                                </div>
                                <div style={{ flex:1 }}>
                                  <label style={{ fontSize:11, fontWeight:700, color:'#888', display:'block', marginBottom:4 }}>Departure</label>
                                  <input type="time" value={editForm.departure_time} onChange={e => setEditForm(f => ({...f, departure_time: e.target.value}))} style={inp} />
                                </div>
                              </div>
                              <input value={editForm.notes} onChange={e => setEditForm(f => ({...f, notes: e.target.value}))} placeholder="Notes (optional)" style={inp} />
                              <div style={{ display:'flex', gap:8 }}>
                                <button onClick={updateStop} disabled={saving || !editForm.location_name}
                                  style={{ flex:1, padding:'10px', borderRadius:8, border:'none', background:'#f97316', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', opacity: saving ? 0.6 : 1 }}>
                                  {saving ? 'Saving…' : '✓ Save Changes'}
                                </button>
                                <button onClick={() => setEditingStop(null)}
                                  style={{ padding:'10px 16px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:'#555', fontWeight:600, fontSize:14, cursor:'pointer' }}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                          <div key={stop.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'#f9fafb', borderRadius:8, marginBottom:6 }}>
                            <div style={{ fontSize:16 }}>📍</div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontWeight:700, fontSize:14, color:'#111' }}>{stop.location_name}</div>
                              <div style={{ fontSize:12, color:'#888' }}>{stop.arrival_time} – {stop.departure_time}{stop.notes ? ` · ${stop.notes}` : ''}</div>
                            </div>
                            <button onClick={() => startEditStop(stop)} style={{ background:'none', border:'none', fontSize:15, cursor:'pointer', padding:'0 4px' }}>✏️</button>
                            <button onClick={() => deleteStop(stop.id)} style={{ background:'none', border:'none', color:'#ef4444', fontSize:18, cursor:'pointer', padding:'0 4px' }}>×</button>
                          </div>
                          )
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
