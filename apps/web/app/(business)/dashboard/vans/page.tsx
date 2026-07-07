// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function VansPage() {
  const [vans, setVans]       = useState<any[]>([])
  const [bizName, setBizName] = useState('')
  const [loading, setLoading] = useState(true)
  const [designVan, setDesignVan]         = useState(null)   // van id with the design panel open
  const [designImage, setDesignImage]     = useState<any>(null)
  const [designBrand, setDesignBrand]     = useState<any>(null)
  const [designLoading, setDesignLoading] = useState(false)
  const [designSaving, setDesignSaving]   = useState(false)
  const [designError, setDesignError]     = useState('')
  const [designSaved, setDesignSaved]     = useState(false)

  const openDesign = (van: any) => {
    setDesignVan(designVan === van.id ? null : van.id)
    setDesignImage(null)
    setDesignBrand(van.brand ?? null)
    setDesignError('')
    setDesignSaved(false)
  }

  const pickDesignImage = (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      // Downscale on-device so big phone photos don't exceed upload limits.
      const img = new Image()
      img.onload = () => {
        const MAX = 1400
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        const jpeg = canvas.toDataURL('image/jpeg', 0.85)
        setDesignImage({ data: jpeg.split(',')[1], mediaType: 'image/jpeg', preview: jpeg })
        setDesignError('')
      }
      img.onerror = () => setDesignError('Could not read that image — try a different photo.')
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  const pickLogo = (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const MAX = 256
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        const logo = canvas.toDataURL('image/png')
        setDesignBrand(b => ({ ...(b ?? { primary:'#f97316', secondary:'#ea580c', accent:'#fdba74', bg:'dark', logo_text:'' }), logo }))
        setDesignError('')
      }
      img.onerror = () => setDesignError('Could not read that logo image.')
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  // Some failures (e.g. upload too large) return non-JSON — never crash on parse.
  const safeJson = async (res: any) => {
    try { return await res.json() }
    catch { return { error: res.status === 413 ? 'Photo too large — try again, it will be resized now.' : `Server error (${res.status})` } }
  }

  const scanDesign = async () => {
    if (!designImage) return
    setDesignLoading(true)
    setDesignError('')
    try {
      const res = await fetch('/api/ai/brand-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: { data: designImage.data, mediaType: designImage.mediaType } }),
      })
      const data = await safeJson(res)
      if (!res.ok || data.error) { setDesignError(data.error ?? 'Scan failed'); setDesignLoading(false); return }
      setDesignBrand(b => ({ ...data.brand, ...(b?.logo ? { logo: b.logo } : {}) }))
    } catch (e: any) {
      setDesignError(e.message)
    }
    setDesignLoading(false)
  }

  const saveDesign = async () => {
    if (!designVan || !designBrand) return
    setDesignSaving(true)
    setDesignError('')
    const res = await fetch('/api/vans/brand', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ van_id: designVan, brand: designBrand }),
    })
    const data = await safeJson(res)
    if (!res.ok || data.error) { setDesignError(data.error ?? 'Save failed'); setDesignSaving(false); return }
    setVans(prev => prev.map(v => v.id === designVan ? { ...v, brand: designBrand } : v))
    setDesignSaved(true)
    setDesignSaving(false)
  }

  const resetDesign = async () => {
    if (!designVan) return
    setDesignSaving(true)
    await fetch('/api/vans/brand', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ van_id: designVan, brand: null }),
    })
    setVans(prev => prev.map(v => v.id === designVan ? { ...v, brand: null } : v))
    setDesignBrand(null)
    setDesignImage(null)
    setDesignSaving(false)
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/login'; return }

      let biz: any = null
      const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      if (userData?.id) {
        const { data: b } = await supabase.from('businesses').select('id, name').eq('owner_id', userData.id).maybeSingle()
        biz = b
      }
      if (!biz) {
        const { data: r } = await supabase.rpc('get_my_business')
        if (r) biz = r
      }
      if (!biz) { window.location.href = '/register/business'; return }

      setBizName(biz.name ?? '')
      const { data: vanList } = await supabase.from('vans').select('*').eq('business_id', biz.id)
      setVans(vanList ?? [])
      setLoading(false)
    })
  }, [])

  const NAV = [
    { icon: '📊', label: 'Dashboard', href: '/dashboard' },
    { icon: '🚐', label: 'My Vans',   href: '/dashboard/vans',    active: true },
    { icon: '📦', label: 'Orders',    href: '/dashboard/orders' },
    { icon: '📋', label: 'Menu',      href: '/dashboard/menu' },
    { icon: '💳', label: 'My Plan',   href: '/dashboard/billing' },
  { icon: '💬', label: 'WhatsApp',  href: '/dashboard/whatsapp' },
    { icon: '⚙️', label: 'Settings',  href: '/dashboard/settings' },
  ]

  return (
    <>
      <style>{`
        html,body{margin:0;padding:0}
        .wrap{display:flex;flex-direction:column;min-height:100vh;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
        .topbar{background:#fff;border-bottom:1px solid #e5e7eb;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
        .sidebar{width:220px;flex-shrink:0;background:#fff;border-right:1px solid #e5e7eb;padding:16px 10px;min-height:calc(100vh - 56px)}
        .main{flex:1;padding:24px;overflow-x:hidden;max-width:900px}
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
            <div style={{ margin:'16px 0 0', paddingTop:12, borderTop:'1px solid #f3f4f6' }}>
              <a href="/api/auth/logout" style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:10, fontSize:13, fontWeight:600, textDecoration:'none', color:'#ef4444' }}>🚪 Sign Out</a>
            </div>
          </div>
          <div className="main">
            <div style={{ marginBottom:24 }}>
              <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#111' }}>My Vans</h1>
              <p style={{ color:'#888', margin:0, fontSize:13 }}>Manage your food vans</p>
            </div>

            {loading ? (
              <div style={{ textAlign:'center', padding:40, color:'#888' }}>Loading…</div>
            ) : vans.length === 0 ? (
              <div style={{ background:'#fff', borderRadius:14, padding:'40px', textAlign:'center', boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>🚐</div>
                <div style={{ fontSize:16, fontWeight:700, color:'#111', marginBottom:8 }}>No vans yet</div>
                <div style={{ fontSize:14, color:'#888', marginBottom:20 }}>Add your first van to start taking orders</div>
                <a href="/dashboard/vans/new" style={{ padding:'10px 24px', borderRadius:10, background:'#f97316', color:'#fff', fontSize:14, fontWeight:700, textDecoration:'none' }}>+ Add Van</a>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {vans.map(van => (
                  <div key={van.id} style={{ background:'#fff', borderRadius:12, boxShadow:'0 1px 3px rgba(0,0,0,0.07)', overflow:'hidden' }}>
                    <div style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
                      <div style={{ width:12, height:12, borderRadius:'50%', background: van.tracking_status === 'live' ? '#10b981' : '#d1d5db', flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:15, color:'#111' }}>{van.name || 'Unnamed Van'}</div>
                        <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{van.van_type || 'Van'} · {van.tracking_status === 'live' ? '🟢 Live' : '⚫ Offline'}</div>
                      </div>
                      <button onClick={() => openDesign(van)} style={{ padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:700,
                        background: van.brand ? `linear-gradient(135deg, ${van.brand.primary}, ${van.brand.secondary})` : '#ede9fe',
                        color: van.brand ? '#fff' : '#7c3aed' }}>
                        🎨 {van.brand ? 'My Design' : 'Add Design'}
                      </button>
                      <a href={`/dashboard/vans/${van.id}`} style={{ padding:'7px 16px', borderRadius:8, background:'#f3f4f6', color:'#555', fontSize:13, fontWeight:600, textDecoration:'none' }}>Edit</a>
                    </div>

                    {designVan === van.id && (
                      <div style={{ borderTop:'1px solid #f3f4f6', padding:'16px 20px', background:'#faf5ff' }}>
                        <div style={{ fontSize:13, fontWeight:800, color:'#7c3aed', marginBottom:6 }}>🎨 AI Design Capture</div>
                        <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>Upload your menu, van photo or logo — AI reads your colours and styles your public page to match your brand.</div>

                        {!designImage && (
                          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                            <label style={{ flex:1, textAlign:'center', padding:'14px 10px', borderRadius:10, border:'2px dashed #ddd6fe', cursor:'pointer', background:'#fff' }}>
                              <div style={{ fontSize:22 }}>📷</div>
                              <div style={{ fontSize:12, fontWeight:700, color:'#7c3aed' }}>Camera</div>
                              <input type="file" accept="image/*" capture="camera" onChange={pickDesignImage} style={{ display:'none' }} />
                            </label>
                            <label style={{ flex:1, textAlign:'center', padding:'14px 10px', borderRadius:10, border:'2px dashed #ddd6fe', cursor:'pointer', background:'#fff' }}>
                              <div style={{ fontSize:22 }}>🖼️</div>
                              <div style={{ fontSize:12, fontWeight:700, color:'#7c3aed' }}>Gallery</div>
                              <input type="file" accept="image/*" onChange={pickDesignImage} style={{ display:'none' }} />
                            </label>
                          </div>
                        )}

                        {designImage && (
                          <div style={{ marginBottom:12 }}>
                            <img src={designImage.preview} alt="design" style={{ maxWidth:'100%', maxHeight:180, borderRadius:10, display:'block', marginBottom:8 }} />
                            <div style={{ display:'flex', gap:8 }}>
                              <button onClick={scanDesign} disabled={designLoading} style={{ flex:1, padding:'10px', borderRadius:10, border:'none', background:'#7c3aed', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', opacity: designLoading ? 0.6 : 1 }}>
                                {designLoading ? '⏳ Reading your design…' : '✨ Capture My Brand'}
                              </button>
                              <button onClick={() => { setDesignImage(null) }} style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #e5e7eb', background:'#fff', color:'#555', fontWeight:600, fontSize:13, cursor:'pointer' }}>Change</button>
                            </div>
                          </div>
                        )}

                        {/* Logo upload — independent of colour capture */}
                        <div style={{ background:'#fff', borderRadius:12, padding:14, marginBottom:12, border:'1px solid #ede9fe', display:'flex', alignItems:'center', gap:12 }}>
                          {designBrand?.logo ? (
                            <img src={designBrand.logo} alt="logo" style={{ width:56, height:56, borderRadius:12, objectFit:'cover', border:'1px solid #e5e7eb' }} />
                          ) : (
                            <div style={{ width:56, height:56, borderRadius:12, background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>🏷️</div>
                          )}
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, fontWeight:800, color:'#111' }}>Your Logo</div>
                            <div style={{ fontSize:11, color:'#888' }}>Shown at the top of your public page</div>
                          </div>
                          <label style={{ padding:'8px 14px', borderRadius:8, background:'#7c3aed', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                            {designBrand?.logo ? 'Change' : 'Upload'}
                            <input type="file" accept="image/*" onChange={pickLogo} style={{ display:'none' }} />
                          </label>
                          {designBrand?.logo && (
                            <button onClick={() => setDesignBrand(b => { const { logo, ...rest } = b; return rest })} style={{ background:'none', border:'none', color:'#ef4444', fontSize:18, cursor:'pointer', padding:'0 2px' }}>×</button>
                          )}
                        </div>

                        {designBrand && (
                          <div style={{ background:'#fff', borderRadius:12, padding:14, marginBottom:12, border:'1px solid #ede9fe' }}>
                            <div style={{ fontSize:12, fontWeight:700, color:'#888', marginBottom:8 }}>YOUR BRAND — tap a colour to tweak</div>
                            <div style={{ display:'flex', gap:10, marginBottom:12 }}>
                              {['primary','secondary','accent'].map(k => (
                                <label key={k} style={{ flex:1, textAlign:'center', cursor:'pointer' }}>
                                  <div style={{ height:44, borderRadius:10, background:designBrand[k], border:'1px solid rgba(0,0,0,0.1)' }} />
                                  <div style={{ fontSize:10, fontWeight:700, color:'#888', marginTop:4, textTransform:'capitalize' }}>{k}</div>
                                  <input type="color" value={designBrand[k]} onChange={e => setDesignBrand(b => ({ ...b, [k]: e.target.value }))} style={{ width:0, height:0, opacity:0, position:'absolute' }} />
                                </label>
                              ))}
                            </div>
                            <div style={{ borderRadius:12, overflow:'hidden', border:'1px solid #ede9fe', marginBottom:12 }}>
                              <div style={{ padding:'14px 16px', background: `linear-gradient(135deg, ${designBrand.primary}, ${designBrand.secondary})`, display:'flex', alignItems:'center', gap:10 }}>
                                {designBrand.logo && <img src={designBrand.logo} alt="logo" style={{ width:36, height:36, borderRadius:8, objectFit:'cover' }} />}
                                <div>
                                  <div style={{ fontWeight:900, fontSize:16, color:'#fff' }}>{designBrand.logo_text || van.name}</div>
                                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.85)' }}>Preview of your page header</div>
                                </div>
                              </div>
                              <div style={{ padding:'10px 16px', background: designBrand.bg === 'light' ? '#ffffff' : '#0a0f1e', display:'flex', justifyContent:'space-between' }}>
                                <span style={{ fontSize:13, fontWeight:700, color: designBrand.bg === 'light' ? '#111' : '#e5e7eb' }}>Cod & Chips</span>
                                <span style={{ fontSize:13, fontWeight:800, color: designBrand.accent }}>£12.00</span>
                              </div>
                            </div>
                            <div style={{ display:'flex', gap:8 }}>
                              <button onClick={saveDesign} disabled={designSaving} style={{ flex:1, padding:'11px', borderRadius:10, border:'none', background:`linear-gradient(135deg, ${designBrand.primary}, ${designBrand.secondary})`, color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', opacity: designSaving ? 0.6 : 1 }}>
                                {designSaving ? 'Saving…' : '✓ Use This Design'}
                              </button>
                              {van.brand && (
                                <button onClick={resetDesign} disabled={designSaving} style={{ padding:'11px 14px', borderRadius:10, border:'1px solid #e5e7eb', background:'#fff', color:'#ef4444', fontWeight:600, fontSize:13, cursor:'pointer' }}>Remove</button>
                              )}
                            </div>
                          </div>
                        )}

                        {designSaved && <div style={{ fontSize:13, fontWeight:700, color:'#059669' }}>✅ Design saved — your public page now matches your brand!</div>}
                        {designError && <div style={{ fontSize:13, fontWeight:700, color:'#ef4444' }}>⚠️ {designError}</div>}
                      </div>
                    )}
                  </div>
                ))}
                <a href="/dashboard/vans/new" style={{ display:'block', padding:'16px', borderRadius:12, border:'2px dashed #e5e7eb', textAlign:'center', color:'#888', fontSize:14, fontWeight:600, textDecoration:'none' }}>+ Add another van</a>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
