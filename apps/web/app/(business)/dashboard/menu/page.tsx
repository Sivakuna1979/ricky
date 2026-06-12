// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = ['Starters', 'Mains', 'Sides', 'Desserts', 'Drinks', 'Specials']

const NAV = [
  { icon: '📊', label: 'Dashboard', href: '/dashboard' },
  { icon: '🚐', label: 'My Vans',   href: '/dashboard/vans' },
  { icon: '📦', label: 'Orders',    href: '/dashboard/orders' },
  { icon: '📋', label: 'Menu',      href: '/dashboard/menu', active: true },
  { icon: '💳', label: 'Billing',   href: '/dashboard/billing' },
  { icon: '⚙️', label: 'Settings',  href: '/dashboard/settings' },
]

export default function MenuPage() {
  const [items, setItems]       = useState([])
  const [vanId, setVanId]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm]         = useState({ name:'', description:'', price:'', category:'Mains', available:true })

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/login'; return }
      const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
      const { data: biz } = await supabase.from('businesses').select('id').eq('owner_id', userData.id).maybeSingle()
      if (!biz) { window.location.href = '/register/business'; return }
      const { data: vans } = await supabase.from('vans').select('id').eq('business_id', biz.id).limit(1)
      const vid = vans?.[0]?.id ?? null
      setVanId(vid)
      if (vid) {
        const { data: menuItems } = await supabase.from('menu_items').select('*').eq('van_id', vid).order('category').order('name')
        setItems(menuItems ?? [])
      }
      setLoading(false)
    })
  }, [])

  const openAdd = () => { setEditItem(null); setForm({ name:'', description:'', price:'', category:'Mains', available:true }); setShowForm(true) }
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
    const { data: menuItems } = await supabase.from('menu_items').select('*').eq('van_id', vanId).order('category').order('name')
    setItems(menuItems ?? [])
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

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const catItems = items.filter(i => i.category === cat)
    if (catItems.length) acc[cat] = catItems
    return acc
  }, {})
  const uncategorised = items.filter(i => !CATEGORIES.includes(i.category))
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
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
              <div>
                <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#111' }}>📋 Menu Manager</h1>
                <p style={{ color:'#888', margin:0, fontSize:13 }}>Add and manage your van's menu items</p>
              </div>
              <button onClick={openAdd} style={{ padding:'10px 20px', borderRadius:10, background:'#f97316', color:'#fff', fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>+ Add Item</button>
            </div>

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
                <div style={{ color:'#888', fontSize:14, marginBottom:20 }}>Add your first item to get started</div>
                <button onClick={openAdd} style={{ padding:'11px 24px', borderRadius:10, background:'#f97316', color:'#fff', fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>+ Add First Item</button>
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
    </>
  )
}
