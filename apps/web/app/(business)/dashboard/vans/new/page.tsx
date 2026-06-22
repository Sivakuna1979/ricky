// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const VAN_TYPES = [
  'Fish & Chips', 'Burger Van', 'Pizza Van', 'Coffee Van',
  'Ice Cream Van', 'Kebab Van', 'Street Food', 'Catering Trailer',
  'Mobile Bakery', 'Other',
]

export default function NewVanPage() {
  const [form, setForm]     = useState({ name: '', van_type: 'Fish & Chips', phone: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [bizId, setBizId]   = useState(null)

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
      setBizId(biz.id)
    })
  }, [])

  const save = async () => {
    if (!form.name) { setError('Van name is required'); return }
    if (!bizId) { setError('Business not found'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/vans/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, business_id: bizId }),
    })
    const data = await res.json()
    if (!res.ok || data.error) { setError(data.error ?? 'Failed to create van'); setSaving(false); return }
    window.location.href = '/dashboard/vans'
  }

  const inp: React.CSSProperties = { width:'100%', padding:'11px 14px', borderRadius:10, border:'1px solid #e5e7eb', fontSize:15, outline:'none', boxSizing:'border-box', fontFamily:'inherit' }

  return (
    <>
      <style>{`html,body{margin:0;padding:0;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}`}</style>
      <div style={{ minHeight:'100vh', background:'#f5f6fa' }}>
        {/* Topbar */}
        <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', position:'sticky', top:0, zIndex:100, boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#f97316,#dc2626)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:'#fff' }}>FT</div>
            <span style={{ fontWeight:800, fontSize:15, color:'#111' }}>Add New Van</span>
          </div>
          <a href="/dashboard/vans" style={{ fontSize:13, color:'#6366f1', textDecoration:'none', fontWeight:600 }}>← Back</a>
        </div>

        {/* Form */}
        <div style={{ maxWidth:520, margin:'32px auto', padding:'0 16px 80px' }}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize:24, marginBottom:4 }}>🚐</div>
            <h1 style={{ fontSize:20, fontWeight:800, color:'#111', margin:'0 0 6px' }}>Add Your Van</h1>
            <p style={{ fontSize:13, color:'#888', margin:'0 0 24px' }}>Enter your van details below</p>

            {error && <div style={{ background:'#fee2e2', color:'#991b1b', borderRadius:10, padding:'10px 14px', fontSize:13, fontWeight:600, marginBottom:16 }}>⚠️ {error}</div>}

            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'#555', display:'block', marginBottom:6 }}>Van Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="e.g. Howe & Co Van 45" style={inp} />
            </div>

            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'#555', display:'block', marginBottom:6 }}>Van Type</label>
              <select value={form.van_type} onChange={e => setForm(p => ({...p, van_type: e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                {VAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'#555', display:'block', marginBottom:6 }}>Phone Number</label>
              <input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} placeholder="e.g. 07961929557" type="tel" style={inp} />
            </div>

            <div style={{ marginBottom:24 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'#555', display:'block', marginBottom:6 }}>Description (optional)</label>
              <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="Brief description of your van..." rows={3}
                style={{ ...inp, resize:'vertical' }} />
            </div>

            <button onClick={save} disabled={saving || !bizId} style={{ width:'100%', padding:'14px', borderRadius:12, border:'none', background: saving ? 'rgba(249,115,22,0.5)' : 'linear-gradient(135deg,#f97316,#ea580c)', color:'#fff', fontSize:16, fontWeight:800, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Adding Van…' : '🚐 Add Van'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
