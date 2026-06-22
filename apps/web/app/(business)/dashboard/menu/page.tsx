// @ts-nocheck
'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = ['Fish', 'Chips', 'Burgers', 'Chicken', 'Vegetarian', 'Sides', 'Extras', 'Drinks', 'Desserts', 'Specials', 'Mains', 'Starters']

const NAV = [
  { icon: '📊', label: 'Dashboard', href: '/dashboard' },
  { icon: '🚐', label: 'My Vans',   href: '/dashboard/vans' },
  { icon: '📦', label: 'Orders',    href: '/dashboard/orders' },
  { icon: '📋', label: 'Menu',      href: '/dashboard/menu', active: true },
  { icon: '💳', label: 'Billing',   href: '/dashboard/billing' },
  { icon: '⚙️', label: 'Settings',  href: '/dashboard/settings' },
]

/* ── AI Scan Modal ────────────────────────────────────────────── */
function AIScanModal({ vanId, onClose, onImported }) {
  const [stage, setStage]       = useState('upload') // upload | scanning | review | saving | done
  const [preview, setPreview]   = useState(null)
  const [imageData, setImageData] = useState(null)
  const [mediaType, setMediaType] = useState('image/jpeg')
  const [scanned, setScanned]   = useState(null)  // { business_name, phone, items[] }
  const [selected, setSelected] = useState({})
  const [error, setError]       = useState('')
  const cameraRef = useRef()
  const galleryRef = useRef()

  const onFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setMediaType(file.type || 'image/jpeg')
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target.result
      setPreview(dataUrl)
      // Strip the data:image/...;base64, prefix
      setImageData(dataUrl.split(',')[1])
    }
    reader.readAsDataURL(file)
  }

  const scan = async () => {
    if (!imageData) return
    setStage('scanning')
    setError('')
    try {
      const res  = await fetch('/api/menu/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: imageData, mediaType }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error ?? 'Scan failed'); setStage('upload'); return }
      setScanned(data)
      // Default all items selected
      const sel = {}
      ;(data.items ?? []).forEach((_, i) => { sel[i] = true })
      setSelected(sel)
      setStage('review')
    } catch (e) {
      setError(e.message ?? 'Network error')
      setStage('upload')
    }
  }

  const importSelected = async () => {
    setStage('saving')
    const toInsert = (scanned.items ?? [])
      .filter((_, i) => selected[i])
      .map(item => ({
        name:        item.name,
        description: item.description ?? '',
        price:       parseFloat(item.price) || 0,
        category:    item.category ?? 'Mains',
      }))
    const res = await fetch('/api/menu/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: toInsert, vanId }),
    })
    const data = await res.json()
    if (!res.ok || data.error) { setError(data.error ?? 'Import failed'); setStage('review'); return }
    setStage('done')
    onImported()
  }

  const toggleAll = (val) => {
    const sel = {}
    ;(scanned?.items ?? []).forEach((_, i) => { sel[i] = val })
    setSelected(sel)
  }

  const ov = { position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }
  const card = { background:'#fff', borderRadius:20, width:'100%', maxWidth:560, maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.3)', position:'relative' }

  return (
    <div style={ov} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={card}>
        {/* Header */}
        <div style={{ padding:'20px 24px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:19, fontWeight:800, color:'#111' }}>🤖 AI Menu Scanner</div>
            <div style={{ fontSize:12, color:'#888', marginTop:2 }}>Upload your menu card — AI extracts everything automatically</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#aaa', lineHeight:1 }}>✕</button>
        </div>

        <div style={{ padding:24 }}>
          {error && <div style={{ background:'#fee2e2', color:'#991b1b', borderRadius:10, padding:'10px 14px', fontSize:13, fontWeight:600, marginBottom:16 }}>⚠️ {error}</div>}

          {/* UPLOAD */}
          {(stage === 'upload') && (
            <div>
              {/* Preview */}
              {preview ? (
                <div style={{ marginBottom:16 }}>
                  <img src={preview} alt="Menu preview" style={{ maxWidth:'100%', maxHeight:280, borderRadius:12, objectFit:'contain', display:'block', margin:'0 auto' }} />
                </div>
              ) : (
                <div style={{ border:'2px dashed #e5e7eb', borderRadius:14, padding:'28px 20px', textAlign:'center', background:'#fafafa', marginBottom:16 }}>
                  <div style={{ fontSize:44, marginBottom:8 }}>🍽️</div>
                  <div style={{ fontWeight:700, fontSize:15, color:'#333', marginBottom:4 }}>Choose your menu card</div>
                  <div style={{ fontSize:12, color:'#888' }}>Take a photo or pick from your gallery</div>
                </div>
              )}

              {/* Two upload buttons */}
              {!preview && (
                <div style={{ display:'flex', gap:10, marginBottom:0 }}>
                  <button
                    onClick={() => cameraRef.current?.click()}
                    style={{ flex:1, padding:'13px 10px', borderRadius:12, border:'1.5px solid #f97316', background:'#fff7ed', color:'#ea580c', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}
                  >
                    📷 Take Photo
                  </button>
                  <button
                    onClick={() => galleryRef.current?.click()}
                    style={{ flex:1, padding:'13px 10px', borderRadius:12, border:'1.5px solid #6366f1', background:'#eef2ff', color:'#4338ca', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}
                  >
                    🖼️ Upload from Gallery
                  </button>
                </div>
              )}

              {/* Hidden inputs — one with capture, one without */}
              <input ref={cameraRef}  type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display:'none' }} />
              <input ref={galleryRef} type="file" accept="image/*" onChange={onFile} style={{ display:'none' }} />

              {preview && (
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => { setPreview(null); setImageData(null) }} style={{ flex:1, padding:'12px', borderRadius:10, border:'1px solid #e5e7eb', background:'#f9fafb', fontSize:14, fontWeight:600, cursor:'pointer', color:'#555' }}>
                    ← Change
                  </button>
                  <button onClick={scan} style={{ flex:2, padding:'12px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#f97316,#ea580c)', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer' }}>
                    🤖 Scan Menu
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SCANNING */}
          {stage === 'scanning' && (
            <div style={{ textAlign:'center', padding:'40px 0' }}>
              <div style={{ fontSize:52, marginBottom:16 }}>🔍</div>
              <div style={{ fontWeight:800, fontSize:17, color:'#111', marginBottom:8 }}>Reading your menu card…</div>
              <div style={{ fontSize:13, color:'#888', marginBottom:24 }}>AI is extracting all items, prices and categories</div>
              <div style={{ display:'flex', justifyContent:'center', gap:6 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width:10, height:10, borderRadius:'50%', background:'#f97316', animation:`pulse 1.2s ease-in-out ${i*0.4}s infinite` }} />
                ))}
              </div>
              <style>{`@keyframes pulse{0%,80%,100%{opacity:.3;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}`}</style>
            </div>
          )}

          {/* REVIEW */}
          {stage === 'review' && scanned && (
            <div>
              {(scanned.business_name || scanned.phone) && (
                <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:13 }}>
                  {scanned.business_name && <div style={{ fontWeight:700, color:'#065f46' }}>🏪 {scanned.business_name}</div>}
                  {scanned.phone && <div style={{ color:'#047857', marginTop:2 }}>📞 {scanned.phone}</div>}
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div style={{ fontWeight:700, fontSize:15, color:'#111' }}>
                  ✅ Found {(scanned.items??[]).length} items — select which to import:
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => toggleAll(true)}  style={{ fontSize:11, padding:'4px 10px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', fontWeight:600 }}>All</button>
                  <button onClick={() => toggleAll(false)} style={{ fontSize:11, padding:'4px 10px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', fontWeight:600 }}>None</button>
                </div>
              </div>

              <div style={{ maxHeight:360, overflowY:'auto', border:'1px solid #e5e7eb', borderRadius:12 }}>
                {(scanned.items ?? []).map((item, i) => (
                  <label key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderBottom:'1px solid #f3f4f6', cursor:'pointer', background: selected[i] ? '#fff7ed' : '#fff' }}>
                    <input type="checkbox" checked={!!selected[i]} onChange={e => setSelected(p => ({...p, [i]: e.target.checked}))} style={{ width:16, height:16, flexShrink:0 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:'#111' }}>{item.name}</div>
                      <div style={{ fontSize:11, color:'#f97316', fontWeight:600, marginTop:1 }}>{item.category}</div>
                      {item.description && <div style={{ fontSize:11, color:'#888', marginTop:1 }}>{item.description}</div>}
                    </div>
                    <div style={{ fontWeight:800, fontSize:15, color:'#059669', flexShrink:0 }}>£{parseFloat(item.price||0).toFixed(2)}</div>
                  </label>
                ))}
              </div>

              <div style={{ display:'flex', gap:10, marginTop:16 }}>
                <button onClick={() => setStage('upload')} style={{ flex:1, padding:'12px', borderRadius:10, border:'1px solid #e5e7eb', background:'#f9fafb', fontSize:14, fontWeight:600, cursor:'pointer', color:'#555' }}>
                  ← Re-scan
                </button>
                <button
                  onClick={importSelected}
                  disabled={!Object.values(selected).some(Boolean)}
                  style={{ flex:2, padding:'12px', borderRadius:10, border:'none', background: Object.values(selected).some(Boolean) ? 'linear-gradient(135deg,#f97316,#ea580c)' : '#e5e7eb', color: Object.values(selected).some(Boolean) ? '#fff' : '#aaa', fontSize:15, fontWeight:800, cursor: Object.values(selected).some(Boolean) ? 'pointer' : 'not-allowed' }}
                >
                  Import {Object.values(selected).filter(Boolean).length} Items →
                </button>
              </div>
            </div>
          )}

          {/* SAVING */}
          {stage === 'saving' && (
            <div style={{ textAlign:'center', padding:'40px 0' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>💾</div>
              <div style={{ fontWeight:700, fontSize:16, color:'#111' }}>Adding items to your menu…</div>
            </div>
          )}

          {/* DONE */}
          {stage === 'done' && (
            <div style={{ textAlign:'center', padding:'40px 0' }}>
              <div style={{ fontSize:56, marginBottom:12 }}>🎉</div>
              <div style={{ fontWeight:800, fontSize:18, color:'#111', marginBottom:8 }}>Menu imported!</div>
              <div style={{ fontSize:14, color:'#888', marginBottom:24 }}>All selected items have been added to your menu.</div>
              <button onClick={onClose} style={{ padding:'12px 32px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#f97316,#ea580c)', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer' }}>
                View My Menu ✓
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Main Menu Page ───────────────────────────────────────────── */
export default function MenuPage() {
  const [items, setItems]       = useState([])
  const [vanId, setVanId]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showScan, setShowScan] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm]         = useState({ name:'', description:'', price:'', category:'Mains', available:true })

  const loadMenu = async (supabase, vid) => {
    const { data: menuItems } = await supabase.from('menu_items').select('*').eq('van_id', vid).order('category').order('name')
    setItems(menuItems ?? [])
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/login'; return }
      let { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      let biz = null
      if (userData?.id) {
        const { data: b } = await supabase.from('businesses').select('id').eq('owner_id', userData.id).maybeSingle()
        biz = b
      }
      if (!biz) { const { data: r } = await supabase.rpc('get_my_business'); if (r) biz = r }
      if (!biz) { window.location.href = '/register/business'; return }
      const { data: vans } = await supabase.from('vans').select('id').eq('business_id', biz.id).limit(1)
      const vid = vans?.[0]?.id ?? null
      setVanId(vid)
      if (vid) await loadMenu(supabase, vid)
      setLoading(false)
    })
  }, [])

  const openAdd  = () => { setEditItem(null); setForm({ name:'', description:'', price:'', category:'Mains', available:true }); setShowForm(true) }
  const openEdit = (item) => { setEditItem(item); setForm({ name:item.name, description:item.description??'', price:String(item.price??''), category:item.category??'Mains', available:item.available??true }); setShowForm(true) }

  const save = async () => {
    if (!form.name || !form.price) { setMsg('Name and price are required'); return }
    setSaving(true); setMsg('')
    const supabase = createClient()
    const payload = { name:form.name, description:form.description, price:parseFloat(form.price)||0, category:form.category, available:form.available, van_id:vanId }
    let err
    if (editItem) {
      ({ error: err } = await supabase.from('menu_items').update(payload).eq('id', editItem.id))
    } else {
      ({ error: err } = await supabase.from('menu_items').insert(payload))
    }
    if (err) { setMsg('Error: ' + err.message); setSaving(false); return }
    await loadMenu(supabase, vanId)
    setShowForm(false); setSaving(false); setMsg('✅ Saved!')
    setTimeout(() => setMsg(''), 3000)
  }

  const del = async (id) => {
    if (!confirm('Delete this item?')) return
    const supabase = createClient()
    await supabase.from('menu_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const toggle = async (item) => {
    const supabase = createClient()
    await supabase.from('menu_items').update({ available: !item.available }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, available: !i.available } : i))
  }

  const onImported = async () => {
    const supabase = createClient()
    if (vanId) await loadMenu(supabase, vanId)
  }

  // Group by actual categories in the data, preserving a sensible order
  const ORDER = ['Fish', 'Chips', 'Burgers', 'Chicken', 'Vegetarian', 'Sides', 'Extras', 'Drinks', 'Desserts', 'Specials', 'Mains', 'Starters', 'Can Drink']
  const allCats = [...new Set(items.map(i => i.category).filter(Boolean))]
  const sortedCats = [
    ...ORDER.filter(c => allCats.includes(c)),
    ...allCats.filter(c => !ORDER.includes(c)),
  ]
  const grouped = sortedCats.reduce((acc, cat) => {
    const catItems = items.filter(i => i.category === cat)
    if (catItems.length) acc[cat] = catItems
    return acc
  }, {} as Record<string, any[]>)
  const uncategorised = items.filter(i => !i.category)
  if (uncategorised.length) grouped['Other'] = uncategorised

  return (
    <>
      <style>{`
        html,body{margin:0;padding:0}
        .biz-wrap{display:flex;flex-direction:column;min-height:100vh;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        .biz-topbar{background:#fff;border-bottom:1px solid #e5e7eb;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
        .biz-sidebar{width:220px;flex-shrink:0;background:#fff;border-right:1px solid #e5e7eb;padding:16px 10px;min-height:calc(100vh - 56px)}
        .biz-main{flex:1;padding:24px;max-width:860px}
        .biz-body{display:flex;flex:1}
        .biz-bottom{display:none;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e5e7eb;z-index:100;padding:6px 0 18px}
        @media(max-width:700px){.biz-sidebar{display:none}.biz-main{padding:16px 14px 90px}.biz-bottom{display:flex;justify-content:space-around}}
      `}</style>

      <div className="biz-wrap">
        <div className="biz-topbar">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#f97316,#dc2626)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:'#fff' }}>FT</div>
            <span style={{ fontWeight:800, fontSize:15, color:'#111' }}>FoodTaxi <span style={{ color:'#f97316' }}>Business</span></span>
          </div>
          <a href="/" style={{ fontSize:12, color:'#6366f1', textDecoration:'none', padding:'5px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontWeight:600 }}>← Public Site</a>
        </div>

        <div className="biz-body">
          <div className="biz-sidebar">
            {NAV.map(n => (
              <a key={n.href} href={n.href} style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:10, marginBottom:3, fontSize:14, fontWeight:600, textDecoration:'none', color: n.active ? '#f97316' : '#555', background: n.active ? '#fff7ed' : 'transparent', border: n.active ? '1px solid #fed7aa' : '1px solid transparent' }}>
                <span>{n.icon}</span>{n.label}
              </a>
            ))}
          </div>

          <div className="biz-main">
            {/* Header */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
              <div>
                <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#111' }}>📋 Menu Manager</h1>
                <p style={{ color:'#888', margin:0, fontSize:13 }}>Add items manually or scan your menu card with AI</p>
              </div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <button onClick={() => setShowScan(true)} style={{ padding:'10px 18px', borderRadius:10, background:'linear-gradient(135deg,#7c3aed,#6d28d9)', color:'#fff', fontWeight:700, fontSize:14, border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
                  🤖 Scan Menu Card
                </button>
                <button onClick={openAdd} style={{ padding:'10px 18px', borderRadius:10, background:'#f97316', color:'#fff', fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>
                  + Add Item
                </button>
              </div>
            </div>

            {/* AI banner (when no items yet) */}
            {!loading && items.length === 0 && (
              <div style={{ background:'linear-gradient(135deg,#7c3aed11,#6d28d911)', border:'1px solid #7c3aed33', borderRadius:14, padding:'20px 24px', marginBottom:20, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                <div style={{ fontSize:40 }}>🤖</div>
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ fontWeight:800, fontSize:16, color:'#111', marginBottom:4 }}>Got a menu card? Let AI do the work.</div>
                  <div style={{ fontSize:13, color:'#555' }}>Upload a photo of your menu card and AI will automatically read all your items, prices and categories — no typing needed.</div>
                </div>
                <button onClick={() => setShowScan(true)} style={{ padding:'12px 22px', borderRadius:12, background:'linear-gradient(135deg,#7c3aed,#6d28d9)', color:'#fff', fontWeight:800, fontSize:14, border:'none', cursor:'pointer', whiteSpace:'nowrap' }}>
                  📸 Scan My Menu Card
                </button>
              </div>
            )}

            {msg && <div style={{ padding:'12px 16px', borderRadius:10, background: msg.startsWith('✅') ? '#d1fae5' : '#fee2e2', color: msg.startsWith('✅') ? '#065f46' : '#991b1b', marginBottom:16, fontWeight:600, fontSize:14 }}>{msg}</div>}

            {loading ? (
              <div style={{ textAlign:'center', padding:60, color:'#888' }}>Loading menu…</div>
            ) : !vanId ? (
              <div style={{ textAlign:'center', padding:60 }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🚐</div>
                <div style={{ color:'#888', fontSize:15 }}>Add a van first to manage your menu</div>
                <a href="/dashboard/vans/new" style={{ display:'inline-block', marginTop:14, padding:'10px 22px', background:'#f97316', color:'#fff', borderRadius:10, fontWeight:700, textDecoration:'none' }}>Add a Van →</a>
              </div>
            ) : items.length === 0 ? (
              <div style={{ textAlign:'center', padding:60, background:'#fff', borderRadius:14, boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>🍽️</div>
                <div style={{ fontWeight:700, fontSize:16, color:'#111', marginBottom:6 }}>No menu items yet</div>
                <div style={{ color:'#888', fontSize:14, marginBottom:20 }}>Scan your menu card or add items manually</div>
                <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
                  <button onClick={() => setShowScan(true)} style={{ padding:'11px 22px', borderRadius:10, background:'linear-gradient(135deg,#7c3aed,#6d28d9)', color:'#fff', fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>🤖 Scan Menu Card</button>
                  <button onClick={openAdd} style={{ padding:'11px 22px', borderRadius:10, background:'#f97316', color:'#fff', fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>+ Add Manually</button>
                </div>
              </div>
            ) : (
              Object.entries(grouped).map(([cat, catItems]) => (
                <div key={cat} style={{ background:'#fff', borderRadius:14, padding:'18px 20px', marginBottom:16, boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
                  <h2 style={{ fontSize:14, fontWeight:700, color:'#f97316', textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 14px', borderBottom:'1px solid #f3f4f6', paddingBottom:10 }}>{cat}</h2>
                  {catItems.map(item => (
                    <div key={item.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid #f9fafb' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontWeight:700, fontSize:15, color:'#111' }}>{item.name}</span>
                          {!item.available && <span style={{ fontSize:11, padding:'1px 8px', borderRadius:10, background:'#fee2e2', color:'#991b1b', fontWeight:600 }}>Unavailable</span>}
                        </div>
                        {item.description && <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{item.description}</div>}
                      </div>
                      <div style={{ fontWeight:800, fontSize:16, color:'#059669', flexShrink:0 }}>£{(item.price ?? 0).toFixed(2)}</div>
                      <button onClick={() => toggle(item)} title={item.available ? 'Mark unavailable' : 'Mark available'} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, padding:'4px' }}>{item.available ? '✅' : '❌'}</button>
                      <button onClick={() => openEdit(item)} style={{ background:'#f3f4f6', border:'none', cursor:'pointer', padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:600, color:'#555' }}>Edit</button>
                      <button onClick={() => del(item.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:18, padding:'4px' }}>🗑</button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        <nav className="biz-bottom">
          {NAV.slice(0,6).map(n => (
            <a key={n.href} href={n.href} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, textDecoration:'none', color: n.active ? '#f97316' : '#9ca3af', fontSize:10, fontWeight:600, minWidth:48 }}>
              <span style={{ fontSize:20 }}>{n.icon}</span>{n.label}
            </a>
          ))}
        </nav>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:'100%', maxWidth:480, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize:18, fontWeight:800, color:'#111', margin:'0 0 20px' }}>{editItem ? 'Edit Item' : 'Add Menu Item'}</h2>
            {[
              { label:'Item Name *', key:'name', type:'text', placeholder:'e.g. Fish & Chips' },
              { label:'Description', key:'description', type:'text', placeholder:'Brief description...' },
              { label:'Price (£) *', key:'price', type:'number', placeholder:'0.00' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, fontWeight:700, color:'#555', display:'block', marginBottom:5 }}>{f.label}</label>
                <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({...p, [f.key]: e.target.value}))} placeholder={f.placeholder}
                  style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:14, outline:'none', boxSizing:'border-box' }} />
              </div>
            ))}
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'#555', display:'block', marginBottom:5 }}>Category</label>
              <select value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))}
                style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:14, outline:'none' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, fontWeight:600, color:'#555', marginBottom:20, cursor:'pointer' }}>
              <input type="checkbox" checked={form.available} onChange={e => setForm(p => ({...p, available: e.target.checked}))} style={{ width:16, height:16 }} />
              Available for order
            </label>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowForm(false)} style={{ flex:1, padding:'11px', borderRadius:10, border:'1px solid #e5e7eb', background:'#f9fafb', fontSize:14, fontWeight:600, cursor:'pointer', color:'#555' }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ flex:2, padding:'11px', borderRadius:10, border:'none', background:'#f97316', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : editItem ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Scan Modal */}
      {showScan && <AIScanModal vanId={vanId} onClose={() => { setShowScan(false); const s = createClient(); if(vanId) loadMenu(s, vanId) }} onImported={onImported} />}
    </>
  )
}
