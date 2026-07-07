// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// Temperature types with UK-safe ranges (matches /api/hygiene/temperature)
const TEMP_TYPES = [
  { key: 'fridge_temp',      label: 'Fridge',      icon: '🧊', hint: '0°C to 8°C',    unit: '°C' },
  { key: 'freezer_temp',     label: 'Freezer',     icon: '❄️', hint: '-25°C to -18°C', unit: '°C' },
  { key: 'hot_holding_temp', label: 'Hot Holding', icon: '♨️', hint: '63°C or above', unit: '°C' },
  { key: 'cooking_temp',     label: 'Cooking',     icon: '🍳', hint: '75°C or above', unit: '°C' },
]

// Simple daily tasks, tailored by business type. Presented as routine jobs —
// plain language, no inspection jargon.
const BASE_OPENING = [
  'Fridges and freezers on and cold',
  'Hot water and soap at the wash sink',
  'Surfaces, boards and utensils clean',
  'Staff well, clean clothes, hands washed',
  'Food covered, labelled and in date',
]
const BASE_CLOSING = [
  'Leftover food covered, labelled and chilled',
  'Waste removed and bins closed',
  'Surfaces and equipment cleaned and dried',
  'Dirty cloths swapped for clean ones',
  'Fridge and freezer doors shut and running',
]
const TYPE_EXTRAS: Record<string, { opening: string[], closing: string[] }> = {
  fish_and_chips: {
    opening: ['Fish delivery checked and kept chilled', 'Frying oil checked (topped up or changed)'],
    closing: ['Frying range cleaned and oil filtered'],
  },
  burger: {
    opening: ['Raw and cooked kept separate (boards and tongs)'],
    closing: ['Grill cleaned and degreased'],
  },
  kebab: {
    opening: ['Raw and cooked kept separate', 'Doner slices cooked through before serving'],
    closing: ['Doner machine cleaned'],
  },
  ice_cream: {
    opening: ['Ice cream mix kept chilled and in date'],
    closing: ['Machine cleaned and sanitised'],
  },
  coffee: {
    opening: ['Milk chilled and in date'],
    closing: ['Steam wand and machine cleaned'],
  },
  bakery: {
    opening: ['Cream/fresh fillings kept chilled'],
    closing: ['Display cabinets emptied and cleaned'],
  },
}

const NAV = [
  { icon: '📊', label: 'Dashboard', href: '/dashboard' },
  { icon: '📦', label: 'Orders',    href: '/dashboard/orders' },
  { icon: '🧼', label: 'Hygiene',   href: '/dashboard/hygiene', active: true },
  { icon: '📋', label: 'Menu',      href: '/dashboard/menu' },
  { icon: '💬', label: 'WhatsApp',  href: '/dashboard/whatsapp' },
  { icon: '⚙️', label: 'Settings',  href: '/dashboard/settings' },
]

export default function HygienePage() {
  const [loading, setLoading]   = useState(true)
  const [biz, setBiz]           = useState<any>(null)
  const [vanId, setVanId]       = useState(null)
  const [userName, setUserName] = useState('')
  const [tab, setTab]           = useState('temps') // temps | checks | records

  // temperature entry
  const [tempType, setTempType]   = useState('fridge_temp')
  const [tempValue, setTempValue] = useState('')
  const [equipment, setEquipment] = useState('')
  const [action, setAction]       = useState('')
  const [tempSaving, setTempSaving] = useState(false)
  const [tempMsg, setTempMsg]     = useState<any>(null)
  const [todayTemps, setTodayTemps] = useState<any[]>([])

  // checklist
  const [checkType, setCheckType] = useState('opening_checklist')
  const [items, setItems]         = useState<any[]>([])
  const [checkSaving, setCheckSaving] = useState(false)
  const [checkMsg, setCheckMsg]   = useState('')
  const [todayChecks, setTodayChecks] = useState<any[]>([])

  // records
  const [recTemps, setRecTemps]   = useState<any[]>([])
  const [recChecks, setRecChecks] = useState<any[]>([])
  const [recDays, setRecDays]     = useState(30)

  const checklistFor = (type: string, businessType: string) => {
    const extras = TYPE_EXTRAS[businessType] ?? { opening: [], closing: [] }
    const base = type === 'opening_checklist' ? BASE_OPENING : BASE_CLOSING
    const extra = type === 'opening_checklist' ? extras.opening : extras.closing
    return [...base, ...extra].map(label => ({ label, completed: false }))
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/login'; return }
      const { data: userData } = await supabase.from('users').select('id, full_name').eq('auth_id', user.id).maybeSingle()
      setUserName(userData?.full_name ?? user.email ?? '')
      let b: any = null
      if (userData?.id) {
        const { data } = await supabase.from('businesses').select('id, name, business_type').eq('owner_id', userData.id).maybeSingle()
        b = data
      }
      if (!b) { const { data: r } = await supabase.rpc('get_my_business'); if (r) b = r }
      if (!b) { window.location.href = '/register/business'; return }
      setBiz(b)
      const { data: vans } = await supabase.from('vans').select('id').eq('business_id', b.id).limit(1)
      setVanId(vans?.[0]?.id ?? null)
      setItems(checklistFor('opening_checklist', b.business_type ?? 'other'))
      await refreshToday(b.id)
      setLoading(false)
    })
  }, [])

  const refreshToday = async (businessId: string) => {
    const res = await fetch(`/api/hygiene/temperature?business_id=${businessId}&days=1`)
    const data = await res.json().catch(() => [])
    setTodayTemps(Array.isArray(data) ? data : [])
    const start = new Date(); start.setHours(0,0,0,0)
    const [op, cl] = await Promise.all([
      fetch(`/api/hygiene/checklist?business_id=${businessId}&type=opening_checklist`).then(r => r.json()).catch(() => []),
      fetch(`/api/hygiene/checklist?business_id=${businessId}&type=closing_checklist`).then(r => r.json()).catch(() => []),
    ])
    const today = [...(Array.isArray(op) ? op : []), ...(Array.isArray(cl) ? cl : [])].filter(l => new Date(l.recorded_at) >= start)
    setTodayChecks(today)
  }

  const loadRecords = async (days: number) => {
    setRecDays(days)
    const res = await fetch(`/api/hygiene/temperature?business_id=${biz.id}&days=${days}`)
    const data = await res.json().catch(() => [])
    setRecTemps(Array.isArray(data) ? data : [])
    const [op, cl] = await Promise.all([
      fetch(`/api/hygiene/checklist?business_id=${biz.id}&type=opening_checklist`).then(r => r.json()).catch(() => []),
      fetch(`/api/hygiene/checklist?business_id=${biz.id}&type=closing_checklist`).then(r => r.json()).catch(() => []),
    ])
    const cutoff = Date.now() - days * 86400000
    setRecChecks([...(Array.isArray(op) ? op : []), ...(Array.isArray(cl) ? cl : [])]
      .filter(l => new Date(l.recorded_at).getTime() >= cutoff)
      .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at)))
  }

  const saveTemp = async () => {
    if (tempValue === '' || isNaN(Number(tempValue))) return
    setTempSaving(true)
    setTempMsg(null)
    const res = await fetch('/api/hygiene/temperature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: biz.id,
        van_id: vanId ?? undefined,
        log_type: tempType,
        equipment_name: equipment || undefined,
        temperature_celsius: Number(tempValue),
        corrective_action: action || undefined,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setTempMsg({ ok: false, text: data.error?.formErrors?.join?.(', ') ?? data.error ?? 'Could not save' }); setTempSaving(false); return }
    setTempMsg({ ok: true, inRange: data.is_within_range, text: data.is_within_range ? '✅ Recorded — within safe range' : '⚠️ Recorded — OUT of safe range. Add what you did about it below and log again if needed.' })
    setTempValue('')
    setAction('')
    await refreshToday(biz.id)
    setTempSaving(false)
  }

  const saveChecklist = async () => {
    setCheckSaving(true)
    setCheckMsg('')
    const res = await fetch('/api/hygiene/checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: biz.id,
        van_id: vanId ?? undefined,
        checklist_type: checkType,
        items,
        digital_signature: userName,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setCheckMsg(`⚠️ ${data.error ?? 'Could not save'}`); setCheckSaving(false); return }
    setCheckMsg('✅ Saved and signed — kept in your records')
    setItems(checklistFor(checkType, biz.business_type ?? 'other'))
    await refreshToday(biz.id)
    setCheckSaving(false)
  }

  const switchCheckType = (t: string) => {
    setCheckType(t)
    setCheckMsg('')
    setItems(checklistFor(t, biz?.business_type ?? 'other'))
  }

  const selType = TEMP_TYPES.find(t => t.key === tempType)
  const inp = { width:'100%', padding:'11px 13px', borderRadius:10, border:'1px solid #e5e7eb', fontSize:15, outline:'none', boxSizing:'border-box' as const, fontFamily:'inherit' }
  const tempCompliance = recTemps.length ? Math.round(100 * recTemps.filter(t => t.is_within_range).length / recTemps.length) : null

  return (
    <>
      <style>{`
        html,body{margin:0;padding:0}
        .wrap{display:flex;flex-direction:column;min-height:100vh;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        .topbar{background:#fff;border-bottom:1px solid #e5e7eb;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
        .sidebar{width:220px;flex-shrink:0;background:#fff;border-right:1px solid #e5e7eb;padding:16px 10px;min-height:calc(100vh - 56px)}
        .main{flex:1;padding:24px;max-width:760px}
        .body{display:flex;flex:1}
        .bottom{display:none;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e5e7eb;z-index:100;padding:6px 0 18px}
        @media(max-width:700px){.sidebar{display:none}.main{padding:16px 14px 90px}.bottom{display:flex;justify-content:space-around}}
        @media print{.topbar,.sidebar,.bottom,.no-print{display:none!important}.main{padding:0;max-width:100%}body{background:#fff}}
      `}</style>
      <div className="wrap">
        <div className="topbar">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#f97316,#dc2626)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:'#fff' }}>FT</div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#111', lineHeight:1 }}>FoodTaxi</div>
              {biz?.name && <div style={{ fontSize:11, color:'#888' }}>{biz.name}</div>}
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
            <h1 className="no-print" style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#111' }}>🧼 Food Hygiene</h1>
            <p className="no-print" style={{ color:'#888', margin:'0 0 16px', fontSize:13 }}>Quick daily records — everything is saved with date, time and name, ready to show your local council inspector.</p>

            {/* Tabs */}
            <div className="no-print" style={{ display:'flex', gap:8, marginBottom:16 }}>
              {[{ k:'temps', l:'🌡️ Temperatures' }, { k:'checks', l:'✅ Daily Checks' }, { k:'records', l:'📋 Council Records' }].map(t => (
                <button key={t.k} onClick={() => { setTab(t.k); if (t.k === 'records') loadRecords(recDays) }}
                  style={{ flex:1, padding:'11px 6px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:800, fontSize:13,
                    background: tab === t.k ? '#0e7490' : '#fff', color: tab === t.k ? '#fff' : '#555', boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
                  {t.l}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign:'center', padding:40, color:'#888' }}>Loading…</div>
            ) : tab === 'temps' ? (
              <>
                <div style={{ background:'#fff', borderRadius:14, padding:18, boxShadow:'0 1px 3px rgba(0,0,0,0.07)', marginBottom:16 }}>
                  <div style={{ fontWeight:800, fontSize:15, color:'#111', marginBottom:12 }}>Record a temperature</div>
                  <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
                    {TEMP_TYPES.map(t => (
                      <button key={t.key} onClick={() => { setTempType(t.key); setTempMsg(null) }}
                        style={{ flex:'1 1 40%', padding:'12px 8px', borderRadius:12, cursor:'pointer', textAlign:'center',
                          border: tempType === t.key ? '2px solid #0e7490' : '1px solid #e5e7eb',
                          background: tempType === t.key ? '#ecfeff' : '#fff' }}>
                        <div style={{ fontSize:22 }}>{t.icon}</div>
                        <div style={{ fontSize:13, fontWeight:800, color:'#111' }}>{t.label}</div>
                        <div style={{ fontSize:11, color:'#888' }}>{t.hint}</div>
                      </button>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <input type="number" step="0.1" inputMode="decimal" value={tempValue} onChange={e => setTempValue(e.target.value)}
                      placeholder={`${selType?.label} temp ${selType?.unit}`} style={{ ...inp, flex:1, fontSize:18, fontWeight:700 }} />
                    <input value={equipment} onChange={e => setEquipment(e.target.value)} placeholder="Which unit? (optional)" style={{ ...inp, flex:1 }} />
                  </div>
                  {tempMsg && !tempMsg.ok === false ? null : null}
                  {tempMsg && tempMsg.ok && !tempMsg.inRange && (
                    <input value={action} onChange={e => setAction(e.target.value)} placeholder="What did you do about it? (e.g. moved food, called engineer)" style={{ ...inp, marginTop:8, border:'1px solid #fca5a5' }} />
                  )}
                  <button onClick={saveTemp} disabled={tempSaving || tempValue === ''}
                    style={{ width:'100%', marginTop:12, padding:'13px', borderRadius:10, border:'none', background:'#0e7490', color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer', opacity: (tempSaving || tempValue === '') ? 0.55 : 1 }}>
                    {tempSaving ? 'Saving…' : '🌡️ Save Reading'}
                  </button>
                  {tempMsg && (
                    <div style={{ marginTop:10, fontSize:13, fontWeight:700, color: tempMsg.ok ? (tempMsg.inRange ? '#059669' : '#b45309') : '#ef4444' }}>{tempMsg.text}</div>
                  )}
                </div>

                <div style={{ background:'#fff', borderRadius:14, padding:18, boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontWeight:800, fontSize:14, color:'#111', marginBottom:10 }}>Today's readings</div>
                  {todayTemps.length === 0 && <div style={{ fontSize:13, color:'#999', fontStyle:'italic' }}>None yet today — aim for at least morning and evening fridge/freezer checks.</div>}
                  {todayTemps.map((t: any) => (
                    <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #f3f4f6', fontSize:13 }}>
                      <span>{TEMP_TYPES.find(x => x.key === t.log_type)?.icon ?? '🌡️'}</span>
                      <span style={{ flex:1, color:'#333' }}>{TEMP_TYPES.find(x => x.key === t.log_type)?.label}{t.equipment_name ? ` · ${t.equipment_name}` : ''}</span>
                      <span style={{ fontWeight:800, color:'#111' }}>{Number(t.temperature_celsius).toFixed(1)}°C</span>
                      <span style={{ padding:'2px 10px', borderRadius:12, fontSize:11, fontWeight:800, background: t.is_within_range ? '#d1fae5' : '#fee2e2', color: t.is_within_range ? '#065f46' : '#991b1b' }}>{t.is_within_range ? 'SAFE' : 'CHECK'}</span>
                      <span style={{ color:'#aaa', fontSize:11 }}>{new Date(t.recorded_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : tab === 'checks' ? (
              <div style={{ background:'#fff', borderRadius:14, padding:18, boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
                <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                  <button onClick={() => switchCheckType('opening_checklist')} style={{ flex:1, padding:'10px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:800, fontSize:13, background: checkType === 'opening_checklist' ? '#fff7ed' : '#f9fafb', color: checkType === 'opening_checklist' ? '#ea580c' : '#666', outline: checkType === 'opening_checklist' ? '2px solid #fdba74' : 'none' }}>🌅 Opening Checks</button>
                  <button onClick={() => switchCheckType('closing_checklist')} style={{ flex:1, padding:'10px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:800, fontSize:13, background: checkType === 'closing_checklist' ? '#eef2ff' : '#f9fafb', color: checkType === 'closing_checklist' ? '#4f46e5' : '#666', outline: checkType === 'closing_checklist' ? '2px solid #c7d2fe' : 'none' }}>🌙 Closing Checks</button>
                </div>
                {todayChecks.some((c: any) => c.log_type === checkType) && (
                  <div style={{ fontSize:12, fontWeight:700, color:'#059669', marginBottom:10 }}>✅ Already done today ({new Date(todayChecks.find((c: any) => c.log_type === checkType).recorded_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}) — you can do it again if needed.</div>
                )}
                {items.map((it, i) => (
                  <label key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 10px', borderRadius:10, marginBottom:6, cursor:'pointer', background: it.completed ? '#f0fdf4' : '#f9fafb', border: it.completed ? '1px solid #bbf7d0' : '1px solid #f3f4f6' }}>
                    <input type="checkbox" checked={it.completed} onChange={() => setItems(prev => prev.map((x, j) => j === i ? { ...x, completed: !x.completed } : x))}
                      style={{ width:22, height:22, accentColor:'#059669' }} />
                    <span style={{ fontSize:14, color:'#333', fontWeight:600 }}>{it.label}</span>
                  </label>
                ))}
                <div style={{ fontSize:12, color:'#888', margin:'10px 0' }}>Signed by <b>{userName}</b> · {new Date().toLocaleDateString('en-GB')}</div>
                <button onClick={saveChecklist} disabled={checkSaving || !items.some(i => i.completed)}
                  style={{ width:'100%', padding:'13px', borderRadius:10, border:'none', background: items.every(i => i.completed) ? '#059669' : '#0e7490', color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer', opacity: checkSaving ? 0.6 : 1 }}>
                  {checkSaving ? 'Saving…' : items.every(i => i.completed) ? '✓ All done — Sign & Save' : '✓ Sign & Save (some items unticked)'}
                </button>
                {checkMsg && <div style={{ marginTop:10, fontSize:13, fontWeight:700, color: checkMsg.startsWith('✅') ? '#059669' : '#ef4444' }}>{checkMsg}</div>}
              </div>
            ) : (
              <>
                <div className="no-print" style={{ display:'flex', gap:8, marginBottom:14, alignItems:'center' }}>
                  {[30, 60, 90].map(d => (
                    <button key={d} onClick={() => loadRecords(d)} style={{ padding:'8px 14px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:13, background: recDays === d ? '#0e7490' : '#fff', color: recDays === d ? '#fff' : '#555', boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>{d} days</button>
                  ))}
                  <div style={{ flex:1 }} />
                  <button onClick={() => window.print()} style={{ padding:'8px 16px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:800, fontSize:13, background:'#111', color:'#fff' }}>🖨️ Print for Inspector</button>
                </div>

                <div style={{ background:'#fff', borderRadius:14, padding:18, boxShadow:'0 1px 3px rgba(0,0,0,0.07)', marginBottom:16 }}>
                  <div style={{ fontWeight:900, fontSize:16, color:'#111' }}>{biz?.name} — Food Safety Records</div>
                  <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>Last {recDays} days · generated {new Date().toLocaleDateString('en-GB')}</div>
                  <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:120, background:'#f9fafb', borderRadius:10, padding:'12px', textAlign:'center' }}>
                      <div style={{ fontSize:22, fontWeight:900, color:'#0e7490' }}>{recTemps.length}</div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#888' }}>TEMP READINGS</div>
                    </div>
                    <div style={{ flex:1, minWidth:120, background:'#f9fafb', borderRadius:10, padding:'12px', textAlign:'center' }}>
                      <div style={{ fontSize:22, fontWeight:900, color: tempCompliance === null ? '#999' : tempCompliance >= 95 ? '#059669' : '#b45309' }}>{tempCompliance === null ? '—' : `${tempCompliance}%`}</div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#888' }}>WITHIN SAFE RANGE</div>
                    </div>
                    <div style={{ flex:1, minWidth:120, background:'#f9fafb', borderRadius:10, padding:'12px', textAlign:'center' }}>
                      <div style={{ fontSize:22, fontWeight:900, color:'#4f46e5' }}>{recChecks.length}</div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#888' }}>DAILY CHECKS SIGNED</div>
                    </div>
                  </div>
                </div>

                <div style={{ background:'#fff', borderRadius:14, padding:18, boxShadow:'0 1px 3px rgba(0,0,0,0.07)', marginBottom:16 }}>
                  <div style={{ fontWeight:800, fontSize:14, color:'#111', marginBottom:10 }}>🌡️ Temperature log</div>
                  {recTemps.length === 0 && <div style={{ fontSize:13, color:'#999', fontStyle:'italic' }}>No readings in this period</div>}
                  {recTemps.map((t: any) => (
                    <div key={t.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom:'1px solid #f3f4f6', fontSize:12, flexWrap:'wrap' }}>
                      <span style={{ minWidth:96, color:'#666' }}>{new Date(t.recorded_at).toLocaleDateString('en-GB')} {new Date(t.recorded_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}</span>
                      <span style={{ flex:1, color:'#333', fontWeight:600 }}>{TEMP_TYPES.find(x => x.key === t.log_type)?.label ?? t.log_type}{t.equipment_name ? ` (${t.equipment_name})` : ''}</span>
                      <span style={{ fontWeight:800 }}>{Number(t.temperature_celsius).toFixed(1)}°C</span>
                      <span style={{ padding:'1px 8px', borderRadius:10, fontSize:10, fontWeight:800, background: t.is_within_range ? '#d1fae5' : '#fee2e2', color: t.is_within_range ? '#065f46' : '#991b1b' }}>{t.is_within_range ? 'SAFE' : 'ACTION'}</span>
                      {t.corrective_action && <span style={{ width:'100%', color:'#b45309', fontSize:11 }}>↳ {t.corrective_action}</span>}
                    </div>
                  ))}
                </div>

                <div style={{ background:'#fff', borderRadius:14, padding:18, boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontWeight:800, fontSize:14, color:'#111', marginBottom:10 }}>✅ Daily checks</div>
                  {recChecks.length === 0 && <div style={{ fontSize:13, color:'#999', fontStyle:'italic' }}>No checks in this period</div>}
                  {recChecks.map((c: any) => (
                    <div key={c.id} style={{ padding:'8px 0', borderBottom:'1px solid #f3f4f6', fontSize:12 }}>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <span style={{ minWidth:96, color:'#666' }}>{new Date(c.recorded_at).toLocaleDateString('en-GB')} {new Date(c.recorded_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}</span>
                        <span style={{ flex:1, fontWeight:700, color:'#333' }}>{c.log_type === 'opening_checklist' ? '🌅 Opening checks' : '🌙 Closing checks'}</span>
                        <span style={{ padding:'1px 8px', borderRadius:10, fontSize:10, fontWeight:800, background: c.is_compliant ? '#d1fae5' : '#fef3c7', color: c.is_compliant ? '#065f46' : '#92400e' }}>{c.is_compliant ? 'ALL DONE' : 'PARTIAL'}</span>
                      </div>
                      <div style={{ color:'#888', fontSize:11, marginTop:2 }}>Signed: {c.digital_signature ?? c.users?.full_name ?? '—'} · {(c.data?.items ?? []).filter((i: any) => i.completed).length}/{(c.data?.items ?? []).length} items</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <nav className="bottom">
          {NAV.map(n => (
            <a key={n.href} href={n.href} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, textDecoration:'none', color: n.active ? '#f97316' : '#9ca3af', fontSize:10, fontWeight:600, minWidth:48 }}>
              <span style={{ fontSize:20 }}>{n.icon}</span>{n.label}
            </a>
          ))}
        </nav>
      </div>
    </>
  )
}
