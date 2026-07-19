// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// Temperature types with UK-safe ranges (matches /api/hygiene/temperature).
// pick: scroll-wheel range and a sensible default so logging is one scroll.
const TEMP_TYPES = [
  { key: 'fridge_temp',      label: 'Fridge',      icon: '🧊', hint: '0°C to 8°C',     pick: { from: -5,  to: 15,  def: 4 } },
  { key: 'freezer_temp',     label: 'Freezer',     icon: '❄️', hint: '-25°C to -18°C', pick: { from: -30, to: 5,   def: -18 } },
  { key: 'hot_holding_temp', label: 'Hot Holding', icon: '♨️', hint: '63°C or above',  pick: { from: 40,  to: 100, def: 70 } },
  { key: 'cooking_temp',     label: 'Cooking',     icon: '🍳', hint: '75°C or above',  pick: { from: 50,  to: 110, def: 80 } },
]

// 0.5° steps for the scroll picker
function tempOptions(pick: any) {
  const opts = []
  for (let v = pick.to; v >= pick.from; v -= 0.5) opts.push(v)
  return opts
}

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
  { icon: '🎪', label: 'Events',    href: '/van/events' },
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
  const [tempValue, setTempValue] = useState('4') // fridge default
  const [equipment, setEquipment] = useState('')
  const [action, setAction]       = useState('')
  const [tempSaving, setTempSaving] = useState(false)
  const [tempMsg, setTempMsg]     = useState<any>(null)
  const [todayTemps, setTodayTemps] = useState<any[]>([])
  const [units, setUnits]         = useState<any>({}) // { fridge_temp: ['Fridge 1', ...], ... }

  // checklist
  const [checkType, setCheckType] = useState('opening_checklist')
  const [items, setItems]         = useState<any[]>([])
  const [checkSaving, setCheckSaving] = useState(false)
  const [checkMsg, setCheckMsg]   = useState('')
  const [todayChecks, setTodayChecks] = useState<any[]>([])

  // records
  const [recTemps, setRecTemps]   = useState<any[]>([])
  const [recChecks, setRecChecks] = useState<any[]>([])
  const [recOther, setRecOther]   = useState<any[]>([])
  const [recRange, setRecRange]   = useState<any>(null)

  // extra checks (deliveries, probe calibration, weekly review)
  const [moreLogs, setMoreLogs]   = useState<any[]>([])
  const [delivery, setDelivery]   = useState({ supplier:'', kind:'chilled', temp:'3', packagingOk:true, inDate:true })
  const [delSaving, setDelSaving] = useState(false)
  const [delMsg, setDelMsg]       = useState('')
  const [probe, setProbe]         = useState({ ice:'0', boil:'100' })
  const [probeSaving, setProbeSaving] = useState(false)
  const [probeMsg, setProbeMsg]   = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [revSaving, setRevSaving] = useState(false)
  const [revMsg, setRevMsg]       = useState('')

  const refreshMore = async (businessId: string) => {
    const data = await fetch(`/api/hygiene/log?business_id=${businessId}&types=supplier,maintenance,haccp&days=120`).then(r => r.json()).catch(() => [])
    setMoreLogs(Array.isArray(data) ? data : [])
  }
  const lastOf = (type: string) => moreLogs.find((l: any) => l.log_type === type)
  const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000)

  const postLog = async (log_type: string, data: any, is_compliant: boolean, notes = '') => {
    const res = await fetch('/api/hygiene/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: biz.id, van_id: vanId ?? undefined, log_type, data, is_compliant, notes, digital_signature: userName }),
    })
    const out = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(out.error ?? 'Could not save')
    await refreshMore(biz.id)
  }

  const saveDelivery = async () => {
    if (!delivery.supplier.trim()) { setDelMsg('⚠️ Enter the supplier name'); return }
    setDelSaving(true); setDelMsg('')
    try {
      const t = Number(delivery.temp)
      const tempOk = delivery.kind === 'ambient' ? true : delivery.kind === 'chilled' ? t <= 8 : t <= -15
      const ok = tempOk && delivery.packagingOk && delivery.inDate
      await postLog('supplier', { ...delivery, temp: delivery.kind === 'ambient' ? null : t, accepted: ok }, ok)
      setDelMsg(ok ? '✅ Delivery recorded — accepted' : '⚠️ Recorded as REJECTED / needs action — noted for your records')
      setDelivery({ supplier:'', kind: delivery.kind, temp: delivery.kind === 'frozen' ? '-18' : '3', packagingOk:true, inDate:true })
    } catch (e: any) { setDelMsg(`⚠️ ${e.message}`) }
    setDelSaving(false)
  }

  const saveProbe = async () => {
    setProbeSaving(true); setProbeMsg('')
    try {
      const ice = Number(probe.ice), boil = Number(probe.boil)
      const pass = ice >= -1 && ice <= 1 && boil >= 99 && boil <= 101
      await postLog('maintenance', { check: 'probe_calibration', ice, boil, pass }, pass)
      setProbeMsg(pass ? '✅ Probe calibration PASSED — recorded' : '⚠️ Probe out of tolerance — recorded. Replace or recalibrate your thermometer.')
    } catch (e: any) { setProbeMsg(`⚠️ ${e.message}`) }
    setProbeSaving(false)
  }

  const saveReview = async () => {
    setRevSaving(true); setRevMsg('')
    try {
      await postLog('haccp', { check: 'weekly_review', note: reviewNote }, true, reviewNote)
      setRevMsg('✅ Weekly review signed and recorded')
      setReviewNote('')
    } catch (e: any) { setRevMsg(`⚠️ ${e.message}`) }
    setRevSaving(false)
  }

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
      // Remember this business's fridges/freezers from past readings
      const hist = await fetch(`/api/hygiene/temperature?business_id=${b.id}&days=365`).then(r => r.json()).catch(() => [])
      const u: any = {}
      for (const t of Array.isArray(hist) ? hist : []) {
        if (!t.equipment_name) continue
        u[t.log_type] = u[t.log_type] ?? []
        if (!u[t.log_type].includes(t.equipment_name)) u[t.log_type].push(t.equipment_name)
      }
      setUnits(u)
      await refreshToday(b.id)
      await refreshMore(b.id)
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

  // Load records for an exact date range [start, end)
  const loadRecords = async (range: any) => {
    setRecRange(range)
    const days = Math.max(1, Math.ceil((Date.now() - range.start.getTime()) / 86400000) + 1)
    const res = await fetch(`/api/hygiene/temperature?business_id=${biz.id}&days=${days}`)
    const data = await res.json().catch(() => [])
    const inRange = (d: string) => { const t = new Date(d).getTime(); return t >= range.start.getTime() && t < range.end.getTime() }
    setRecTemps((Array.isArray(data) ? data : []).filter((t: any) => inRange(t.recorded_at)))
    const [op, cl] = await Promise.all([
      fetch(`/api/hygiene/checklist?business_id=${biz.id}&type=opening_checklist`).then(r => r.json()).catch(() => []),
      fetch(`/api/hygiene/checklist?business_id=${biz.id}&type=closing_checklist`).then(r => r.json()).catch(() => []),
    ])
    setRecChecks([...(Array.isArray(op) ? op : []), ...(Array.isArray(cl) ? cl : [])]
      .filter(l => inRange(l.recorded_at))
      .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at)))
    const other = await fetch(`/api/hygiene/log?business_id=${biz.id}&types=supplier,maintenance,haccp&days=${days}`).then(r => r.json()).catch(() => [])
    setRecOther((Array.isArray(other) ? other : []).filter((l: any) => inRange(l.recorded_at)))
  }

  // Selectable weekly (Mon–Sun) and monthly periods
  const weekOptions = Array.from({ length: 8 }, (_, i) => {
    const now = new Date(); now.setHours(0,0,0,0)
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) - i * 7)
    const end = new Date(monday); end.setDate(monday.getDate() + 7)
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
    const label = i === 0 ? 'This week' : i === 1 ? 'Last week' : `${monday.toLocaleDateString('en-GB', { day:'numeric', month:'short' })} – ${sunday.toLocaleDateString('en-GB', { day:'numeric', month:'short' })}`
    return { key: `w${i}`, mode: 'week', label, start: monday, end }
  })
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); d.setMonth(d.getMonth() - i)
    const end = new Date(d); end.setMonth(d.getMonth() + 1)
    return { key: `m${i}`, mode: 'month', label: d.toLocaleDateString('en-GB', { month:'long', year:'numeric' }), start: d, end }
  })

  // Per-day rollup for the calendar
  const dayStatus = (d: Date) => {
    const dayStart = d.getTime(), dayEnd = dayStart + 86400000
    const temps = recTemps.filter((t: any) => { const x = new Date(t.recorded_at).getTime(); return x >= dayStart && x < dayEnd })
    const checks = recChecks.filter((c: any) => { const x = new Date(c.recorded_at).getTime(); return x >= dayStart && x < dayEnd })
    if (!temps.length && !checks.length) return { cls: 'none', temps, checks }
    if (temps.some((t: any) => !t.is_within_range)) return { cls: 'alert', temps, checks }
    if (temps.length && checks.length) return { cls: 'good', temps, checks }
    return { cls: 'partial', temps, checks }
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
    if (equipment && !(units[tempType] ?? []).includes(equipment)) {
      setUnits((u: any) => ({ ...u, [tempType]: [...(u[tempType] ?? []), equipment] }))
    }
    setAction('')
    await refreshToday(biz.id)
    setTempSaving(false)
  }

  const addUnit = () => {
    const name = prompt(`Name this ${selTypeLabel()} (e.g. "${selTypeLabel()} 2", "Chest freezer")`)
    if (!name?.trim()) return
    setUnits((u: any) => ({ ...u, [tempType]: [...(u[tempType] ?? []), name.trim()] }))
    setEquipment(name.trim())
  }
  const selTypeLabel = () => TEMP_TYPES.find(t => t.key === tempType)?.label ?? 'unit'

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
        .bottom{display:none;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e5e7eb;z-index:100;padding:8px 10px 18px;overflow-x:auto;-webkit-overflow-scrolling:touch;gap:14px;scroll-snap-type:x proximity;overscroll-behavior-x:contain;scrollbar-width:none}
        .bottom::-webkit-scrollbar,.biz-bottom::-webkit-scrollbar{display:none}
        @media(max-width:700px){.sidebar{display:none}.main{padding:16px 14px 90px}.bottom{display:flex;justify-content:flex-start}}
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
              {[{ k:'temps', l:'🌡️ Temps' }, { k:'checks', l:'✅ Checks' }, { k:'more', l:'🚚 More' }, { k:'records', l:'📋 Records' }].map(t => (
                <button key={t.k} onClick={() => { setTab(t.k); if (t.k === 'records') loadRecords(recRange ?? weekOptions[0]) }}
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
                      <button key={t.key} onClick={() => { setTempType(t.key); setTempMsg(null); setTempValue(String(t.pick.def)); setEquipment((units[t.key] ?? [])[0] ?? '') }}
                        style={{ flex:'1 1 40%', padding:'12px 8px', borderRadius:12, cursor:'pointer', textAlign:'center',
                          border: tempType === t.key ? '2px solid #0e7490' : '1px solid #e5e7eb',
                          background: tempType === t.key ? '#ecfeff' : '#fff' }}>
                        <div style={{ fontSize:22 }}>{t.icon}</div>
                        <div style={{ fontSize:13, fontWeight:800, color:'#111' }}>{t.label}</div>
                        <div style={{ fontSize:11, color:'#888' }}>{t.hint}</div>
                      </button>
                    ))}
                  </div>

                  {/* Which unit? Only shows when they have more than one, plus "+ Add" */}
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                    {(units[tempType] ?? []).map((u: string) => (
                      <button key={u} onClick={() => setEquipment(equipment === u ? '' : u)}
                        style={{ padding:'8px 14px', borderRadius:18, cursor:'pointer', fontSize:13, fontWeight:700,
                          border: equipment === u ? '2px solid #0e7490' : '1px solid #e5e7eb',
                          background: equipment === u ? '#ecfeff' : '#fff', color: equipment === u ? '#0e7490' : '#555' }}>
                        {u}
                      </button>
                    ))}
                    <button onClick={addUnit}
                      style={{ padding:'8px 14px', borderRadius:18, cursor:'pointer', fontSize:13, fontWeight:700, border:'1px dashed #cbd5e1', background:'#f9fafb', color:'#888' }}>
                      + Add {selType?.label.toLowerCase()}
                    </button>
                  </div>

                  {/* Scroll & choose the temperature — no typing */}
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <select value={tempValue} onChange={e => setTempValue(e.target.value)}
                      style={{ ...inp, flex:1, fontSize:20, fontWeight:800, textAlign:'center', color:'#0e7490', height:54 }}>
                      {tempValue === '' && <option value="">Choose temperature…</option>}
                      {tempOptions(selType?.pick ?? { from:-30, to:110 }).map(v => (
                        <option key={v} value={v}>{v > 0 ? v.toFixed(1) : v.toFixed(1)} °C</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ fontSize:11, color:'#999', marginTop:4, textAlign:'center' }}>Tap and scroll to your thermometer reading</div>
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
            ) : tab === 'more' ? (
              <>
                {/* Delivery / goods-in check */}
                <div style={{ background:'#fff', borderRadius:14, padding:18, boxShadow:'0 1px 3px rgba(0,0,0,0.07)', marginBottom:16 }}>
                  <div style={{ fontWeight:800, fontSize:15, color:'#111', marginBottom:4 }}>🚚 Delivery check</div>
                  <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>Do this when stock arrives — takes 20 seconds.</div>
                  <input value={delivery.supplier} onChange={e => setDelivery(d => ({ ...d, supplier: e.target.value }))} placeholder="Supplier name (e.g. Smales, Booker)" style={{ ...inp, marginBottom:8 }} />
                  <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                    {[['chilled','🧊 Chilled'], ['frozen','❄️ Frozen'], ['ambient','📦 Dry/Ambient']].map(([k, l]) => (
                      <button key={k} onClick={() => setDelivery(d => ({ ...d, kind: k, temp: k === 'frozen' ? '-18' : '3' }))}
                        style={{ flex:1, padding:'9px 4px', borderRadius:10, cursor:'pointer', fontSize:12, fontWeight:700, border: delivery.kind === k ? '2px solid #0e7490' : '1px solid #e5e7eb', background: delivery.kind === k ? '#ecfeff' : '#fff', color: delivery.kind === k ? '#0e7490' : '#555' }}>{l}</button>
                    ))}
                  </div>
                  {delivery.kind !== 'ambient' && (
                    <select value={delivery.temp} onChange={e => setDelivery(d => ({ ...d, temp: e.target.value }))}
                      style={{ ...inp, fontWeight:800, textAlign:'center', color:'#0e7490', marginBottom:8 }}>
                      {tempOptions(delivery.kind === 'frozen' ? { from:-30, to:5 } : { from:-5, to:15 }).map(v => (
                        <option key={v} value={v}>{v.toFixed(1)} °C on arrival</option>
                      ))}
                    </select>
                  )}
                  {[['packagingOk','Packaging clean and undamaged'], ['inDate','All items within date']].map(([k, l]) => (
                    <label key={k} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px', borderRadius:10, marginBottom:6, cursor:'pointer', background: delivery[k] ? '#f0fdf4' : '#fef2f2', border: delivery[k] ? '1px solid #bbf7d0' : '1px solid #fecaca' }}>
                      <input type="checkbox" checked={delivery[k]} onChange={() => setDelivery(d => ({ ...d, [k]: !d[k] }))} style={{ width:20, height:20, accentColor:'#059669' }} />
                      <span style={{ fontSize:13, fontWeight:600, color:'#333' }}>{l}</span>
                    </label>
                  ))}
                  <button onClick={saveDelivery} disabled={delSaving} style={{ width:'100%', marginTop:6, padding:'12px', borderRadius:10, border:'none', background:'#0e7490', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', opacity: delSaving ? 0.6 : 1 }}>
                    {delSaving ? 'Saving…' : '✓ Record Delivery'}
                  </button>
                  {delMsg && <div style={{ marginTop:8, fontSize:13, fontWeight:700, color: delMsg.startsWith('✅') ? '#059669' : '#b45309' }}>{delMsg}</div>}
                </div>

                {/* Probe calibration */}
                <div style={{ background:'#fff', borderRadius:14, padding:18, boxShadow:'0 1px 3px rgba(0,0,0,0.07)', marginBottom:16 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ fontWeight:800, fontSize:15, color:'#111' }}>🌡️ Probe check (monthly)</div>
                    {(() => {
                      const last = moreLogs.find((l: any) => l.log_type === 'maintenance')
                      if (!last) return <span style={{ fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:12, background:'#fee2e2', color:'#991b1b' }}>NEVER DONE</span>
                      const d = daysSince(last.recorded_at)
                      return <span style={{ fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:12, background: d > 30 ? '#fee2e2' : '#d1fae5', color: d > 30 ? '#991b1b' : '#065f46' }}>{d > 30 ? `OVERDUE (${d}d ago)` : `Done ${d}d ago ✓`}</span>
                    })()}
                  </div>
                  <div style={{ fontSize:12, color:'#888', margin:'4px 0 12px' }}>Proves your thermometer reads correctly. Put the probe in iced water, then in boiling water, and record what it shows.</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#666', marginBottom:4 }}>🧊 In iced water (should be ~0°C)</div>
                      <select value={probe.ice} onChange={e => setProbe(p => ({ ...p, ice: e.target.value }))} style={{ ...inp, fontWeight:800, textAlign:'center', color:'#0e7490' }}>
                        {tempOptions({ from:-5, to:5 }).map(v => <option key={v} value={v}>{v.toFixed(1)} °C</option>)}
                      </select>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#666', marginBottom:4 }}>♨️ In boiling water (should be ~100°C)</div>
                      <select value={probe.boil} onChange={e => setProbe(p => ({ ...p, boil: e.target.value }))} style={{ ...inp, fontWeight:800, textAlign:'center', color:'#0e7490' }}>
                        {tempOptions({ from:95, to:105 }).map(v => <option key={v} value={v}>{v.toFixed(1)} °C</option>)}
                      </select>
                    </div>
                  </div>
                  <button onClick={saveProbe} disabled={probeSaving} style={{ width:'100%', marginTop:10, padding:'12px', borderRadius:10, border:'none', background:'#0e7490', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', opacity: probeSaving ? 0.6 : 1 }}>
                    {probeSaving ? 'Saving…' : '✓ Record Probe Check'}
                  </button>
                  {probeMsg && <div style={{ marginTop:8, fontSize:13, fontWeight:700, color: probeMsg.startsWith('✅') ? '#059669' : '#b45309' }}>{probeMsg}</div>}
                </div>

                {/* Weekly review sign-off */}
                <div style={{ background:'#fff', borderRadius:14, padding:18, boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ fontWeight:800, fontSize:15, color:'#111' }}>✍️ Weekly review</div>
                    {(() => {
                      const last = moreLogs.find((l: any) => l.log_type === 'haccp')
                      if (!last) return <span style={{ fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:12, background:'#fee2e2', color:'#991b1b' }}>NEVER DONE</span>
                      const d = daysSince(last.recorded_at)
                      return <span style={{ fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:12, background: d > 7 ? '#fee2e2' : '#d1fae5', color: d > 7 ? '#991b1b' : '#065f46' }}>{d > 7 ? `DUE (${d}d ago)` : `Signed ${d}d ago ✓`}</span>
                    })()}
                  </div>
                  <div style={{ fontSize:12, color:'#888', margin:'4px 0 12px' }}>Once a week: look over your records and sign that you've reviewed them. Note anything that went wrong and what you did.</div>
                  <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={2} placeholder="Any problems this week and what you did (or leave blank if all fine)" style={{ ...inp, resize:'vertical', marginBottom:8 }} />
                  <div style={{ fontSize:12, color:'#888', marginBottom:8 }}>Signing as <b>{userName}</b> · {new Date().toLocaleDateString('en-GB')}</div>
                  <button onClick={saveReview} disabled={revSaving} style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:'#059669', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', opacity: revSaving ? 0.6 : 1 }}>
                    {revSaving ? 'Saving…' : '✍️ Sign This Week\'s Review'}
                  </button>
                  {revMsg && <div style={{ marginTop:8, fontSize:13, fontWeight:700, color: revMsg.startsWith('✅') ? '#059669' : '#b45309' }}>{revMsg}</div>}
                </div>
              </>
            ) : (
              <>
                {/* Pick the report: weekly or monthly, then which one */}
                <div className="no-print" style={{ display:'flex', gap:8, marginBottom:10, alignItems:'center', flexWrap:'wrap' }}>
                  <button onClick={() => loadRecords(weekOptions[0])}
                    style={{ padding:'9px 16px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:800, fontSize:13, background: (recRange?.mode ?? 'week') === 'week' ? '#0e7490' : '#fff', color: (recRange?.mode ?? 'week') === 'week' ? '#fff' : '#555', boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
                    📅 Weekly report
                  </button>
                  <button onClick={() => loadRecords(monthOptions[0])}
                    style={{ padding:'9px 16px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:800, fontSize:13, background: recRange?.mode === 'month' ? '#0e7490' : '#fff', color: recRange?.mode === 'month' ? '#fff' : '#555', boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
                    🗓️ Monthly report
                  </button>
                  <select
                    value={recRange?.key ?? 'w0'}
                    onChange={e => {
                      const all = [...weekOptions, ...monthOptions]
                      const sel = all.find(o => o.key === e.target.value)
                      if (sel) loadRecords(sel)
                    }}
                    style={{ flex:1, minWidth:150, padding:'9px 12px', borderRadius:10, border:'1px solid #e5e7eb', fontSize:13, fontWeight:700, color:'#0e7490', background:'#fff' }}>
                    {((recRange?.mode ?? 'week') === 'week' ? weekOptions : monthOptions).map(o => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </select>
                  <button onClick={() => window.print()} style={{ padding:'9px 16px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:800, fontSize:13, background:'#111', color:'#fff' }}>🖨️ Print</button>
                </div>

                {/* Calendar view */}
                <div style={{ background:'#fff', borderRadius:14, padding:16, boxShadow:'0 1px 3px rgba(0,0,0,0.07)', marginBottom:16 }}>
                  <div style={{ fontWeight:800, fontSize:14, color:'#111', marginBottom:10 }}>📅 {recRange?.label ?? 'This week'} — day by day</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4 }}>
                    {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => (
                      <div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:800, color:'#999', padding:'2px 0' }}>{d}</div>
                    ))}
                    {(() => {
                      if (!recRange) return null
                      const cells = []
                      const first = new Date(recRange.start)
                      const lead = (first.getDay() + 6) % 7
                      for (let i = 0; i < lead; i++) cells.push(<div key={`pad${i}`} />)
                      const today = new Date(); today.setHours(23,59,59,999)
                      for (let d = new Date(first); d < recRange.end; d.setDate(d.getDate() + 1)) {
                        const day = new Date(d)
                        const future = day > today
                        const s = dayStatus(day)
                        const bg = future ? '#fafafa' : s.cls === 'good' ? '#d1fae5' : s.cls === 'alert' ? '#fee2e2' : s.cls === 'partial' ? '#fef3c7' : '#f3f4f6'
                        const fg = future ? '#d1d5db' : s.cls === 'good' ? '#065f46' : s.cls === 'alert' ? '#991b1b' : s.cls === 'partial' ? '#92400e' : '#9ca3af'
                        cells.push(
                          <div key={day.toISOString()} style={{ background:bg, borderRadius:8, padding:'6px 2px', textAlign:'center', minHeight:44 }}>
                            <div style={{ fontSize:12, fontWeight:800, color:fg }}>{day.getDate()}</div>
                            {!future && (s.temps.length > 0 || s.checks.length > 0) && (
                              <div style={{ fontSize:9, fontWeight:700, color:fg }}>
                                {s.temps.length > 0 && `🌡️${s.temps.length}`}{s.checks.length > 0 && ` ✓${s.checks.length}`}
                              </div>
                            )}
                            {!future && s.cls === 'alert' && <div style={{ fontSize:9 }}>⚠️</div>}
                          </div>
                        )
                      }
                      return cells
                    })()}
                  </div>
                  <div style={{ display:'flex', gap:12, marginTop:10, flexWrap:'wrap' }}>
                    {[['#d1fae5','All logged'], ['#fef3c7','Partly logged'], ['#fee2e2','Needs attention'], ['#f3f4f6','Nothing logged']].map(([c, l]) => (
                      <span key={l} style={{ fontSize:10, fontWeight:700, color:'#666', display:'flex', alignItems:'center', gap:4 }}>
                        <span style={{ width:12, height:12, borderRadius:4, background:c, display:'inline-block' }} />{l}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ background:'#fff', borderRadius:14, padding:18, boxShadow:'0 1px 3px rgba(0,0,0,0.07)', marginBottom:16 }}>
                  <div style={{ fontWeight:900, fontSize:16, color:'#111' }}>{biz?.name} — Food Safety Records</div>
                  <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>{recRange?.label ?? ''} · generated {new Date().toLocaleDateString('en-GB')}</div>
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

                <div style={{ background:'#fff', borderRadius:14, padding:18, boxShadow:'0 1px 3px rgba(0,0,0,0.07)', marginTop:16 }}>
                  <div style={{ fontWeight:800, fontSize:14, color:'#111', marginBottom:10 }}>🚚 Deliveries, probe checks & reviews</div>
                  {recOther.length === 0 && <div style={{ fontSize:13, color:'#999', fontStyle:'italic' }}>None in this period</div>}
                  {recOther.map((l: any) => (
                    <div key={l.id} style={{ padding:'8px 0', borderBottom:'1px solid #f3f4f6', fontSize:12 }}>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <span style={{ minWidth:96, color:'#666' }}>{new Date(l.recorded_at).toLocaleDateString('en-GB')} {new Date(l.recorded_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}</span>
                        <span style={{ flex:1, fontWeight:700, color:'#333' }}>
                          {l.log_type === 'supplier' ? `🚚 Delivery — ${l.data?.supplier ?? ''}${l.data?.temp != null ? ` (${Number(l.data.temp).toFixed(1)}°C ${l.data?.kind})` : ''}`
                            : l.log_type === 'maintenance' ? `🌡️ Probe check — ice ${Number(l.data?.ice ?? 0).toFixed(1)}°C / boil ${Number(l.data?.boil ?? 0).toFixed(1)}°C`
                            : `✍️ Weekly review${l.notes ? ` — ${l.notes}` : ''}`}
                        </span>
                        <span style={{ padding:'1px 8px', borderRadius:10, fontSize:10, fontWeight:800, background: l.is_compliant ? '#d1fae5' : '#fee2e2', color: l.is_compliant ? '#065f46' : '#991b1b' }}>{l.is_compliant ? 'OK' : 'ACTION'}</span>
                      </div>
                      <div style={{ color:'#888', fontSize:11, marginTop:2 }}>Signed: {l.digital_signature ?? l.users?.full_name ?? '—'}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <nav className="bottom">
          {NAV.map(n => (
            <a key={n.href} href={n.href} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, textDecoration:'none', color: n.active ? '#f97316' : '#9ca3af', fontSize:10, fontWeight:600, minWidth:56, flexShrink:0, padding:'2px 4px', scrollSnapAlign:'start' }}>
              <span style={{ fontSize:20 }}>{n.icon}</span>{n.label}
            </a>
          ))}
        </nav>
      </div>
    </>
  )
}
