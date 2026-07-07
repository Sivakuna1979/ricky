// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'

export default function AdminWhatsAppPage() {
  const [data, setData]     = useState<any>(null)
  const [error, setError]   = useState('')
  const [form, setForm]     = useState({ business_id:'', van_id:'', phone_number_id:'', access_token:'', display_number:'' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  const load = async () => {
    const res = await fetch('/api/admin/whatsapp')
    const d = await res.json().catch(() => ({ error: `Server error (${res.status})` }))
    if (d.error) { setError(d.error); return }
    setData(d)
  }
  useEffect(() => { load() }, [])

  const bizVans = data?.vans?.filter((v: any) => v.business_id === form.business_id) ?? []
  const channelFor = (bizId: string) => data?.channels?.find((c: any) => c.business_id === bizId)
  const bizName = (id: string) => data?.businesses?.find((b: any) => b.id === id)?.name ?? id?.slice(0, 8)

  const pickBusiness = (bizId: string) => {
    const ch = channelFor(bizId)
    const vans = data?.vans?.filter((v: any) => v.business_id === bizId) ?? []
    setForm({
      business_id: bizId,
      van_id: ch?.van_id ?? vans[0]?.id ?? '',
      phone_number_id: ch?.phone_number_id ?? '',
      access_token: '',
      display_number: ch?.display_number ?? '',
    })
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    const res = await fetch('/api/whatsapp/channel', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await res.json().catch(() => ({ error: `Server error (${res.status})` }))
    if (!res.ok || d.error) { setError(d.error ?? 'Save failed'); setSaving(false); return }
    setSaved(true)
    setSaving(false)
    await load()
  }

  const disconnect = async (bizId: string) => {
    if (!confirm(`Disconnect WhatsApp for ${bizName(bizId)}?`)) return
    await fetch('/api/whatsapp/channel', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: bizId }),
    })
    await load()
  }

  const inp = { width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:13, outline:'none', boxSizing:'border-box' as const, fontFamily:'inherit' }
  const lbl = { fontSize:11, fontWeight:700, color:'#666', display:'block', margin:'10px 0 4px' }

  return (
    <div style={{ minHeight:'100vh', background:'#f5f6fa', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", padding:'20px 16px' }}>
      <div style={{ maxWidth:820, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <h1 style={{ fontSize:20, fontWeight:800, color:'#111', margin:0 }}>💬 WhatsApp Channels — Staff Only</h1>
          <a href="/admin/dashboard" style={{ fontSize:12, color:'#6366f1', textDecoration:'none', fontWeight:600 }}>← Admin</a>
        </div>

        {error && <div style={{ background:'#fee2e2', borderRadius:10, padding:'10px 14px', color:'#991b1b', fontWeight:700, fontSize:13, marginBottom:14 }}>⚠️ {error}</div>}
        {!data && !error && <div style={{ textAlign:'center', padding:40, color:'#888' }}>Loading…</div>}

        {data && (
          <>
            {/* Pending requests */}
            <div style={{ background:'#fff', borderRadius:14, padding:16, boxShadow:'0 1px 3px rgba(0,0,0,0.07)', marginBottom:16 }}>
              <div style={{ fontWeight:800, fontSize:14, color:'#111', marginBottom:10 }}>⏳ Pending setup requests</div>
              {data.requests.filter((r: any) => r.status === 'pending').length === 0 && (
                <div style={{ fontSize:13, color:'#999', fontStyle:'italic' }}>No pending requests</div>
              )}
              {data.requests.filter((r: any) => r.status === 'pending').map((r: any) => (
                <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10, marginBottom:8, flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:180 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:'#111' }}>{bizName(r.business_id)}</div>
                    <div style={{ fontSize:12, color:'#92400e' }}>📞 {r.contact_phone}{r.note ? ` · ${r.note}` : ''}</div>
                    <div style={{ fontSize:11, color:'#b45309' }}>{new Date(r.created_at).toLocaleString('en-GB')}</div>
                  </div>
                  <button onClick={() => pickBusiness(r.business_id)} style={{ padding:'8px 14px', borderRadius:8, border:'none', background:'#128c7e', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>Set up →</button>
                </div>
              ))}
            </div>

            {/* Connect / edit form */}
            <div style={{ background:'#fff', borderRadius:14, padding:16, boxShadow:'0 1px 3px rgba(0,0,0,0.07)', marginBottom:16 }}>
              <div style={{ fontWeight:800, fontSize:14, color:'#111', marginBottom:4 }}>🔌 Connect a business</div>
              <label style={lbl}>Business</label>
              <select value={form.business_id} onChange={e => pickBusiness(e.target.value)} style={inp}>
                <option value="">— choose business —</option>
                {data.businesses.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}{channelFor(b.id) ? ' ✅' : ''}</option>
                ))}
              </select>
              {form.business_id && (
                <>
                  <label style={lbl}>Van that receives the orders</label>
                  <select value={form.van_id} onChange={e => setForm(f => ({ ...f, van_id: e.target.value }))} style={inp}>
                    {bizVans.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  <label style={lbl}>Meta Phone number ID</label>
                  <input value={form.phone_number_id} onChange={e => setForm(f => ({ ...f, phone_number_id: e.target.value }))} placeholder="e.g. 1144608618743220" style={inp} />
                  <label style={lbl}>Access token {channelFor(form.business_id) ? '(blank = keep current)' : ''}</label>
                  <input value={form.access_token} onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))} placeholder="EAA..." type="password" style={inp} />
                  <label style={lbl}>Display number (what the business sees)</label>
                  <input value={form.display_number} onChange={e => setForm(f => ({ ...f, display_number: e.target.value }))} placeholder="+44 7xxx xxxxxx" style={inp} />
                  <button onClick={save} disabled={saving || !form.van_id || !form.phone_number_id}
                    style={{ width:'100%', marginTop:14, padding:'12px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#128c7e,#25d366)', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Saving…' : channelFor(form.business_id) ? '✓ Update channel' : '✓ Activate WhatsApp ordering'}
                  </button>
                  {saved && <div style={{ marginTop:8, fontSize:13, fontWeight:800, color:'#059669' }}>✅ Saved — the business now shows "ACTIVE"</div>}
                </>
              )}
            </div>

            {/* Existing channels */}
            <div style={{ background:'#fff', borderRadius:14, padding:16, boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
              <div style={{ fontWeight:800, fontSize:14, color:'#111', marginBottom:10 }}>📡 Connected businesses</div>
              {data.channels.length === 0 && <div style={{ fontSize:13, color:'#999', fontStyle:'italic' }}>None yet</div>}
              {data.channels.map((c: any) => (
                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'#f9fafb', borderRadius:10, marginBottom:8, flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:180 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:'#111' }}>{bizName(c.business_id)} {c.is_active ? '🟢' : '⚫'}</div>
                    <div style={{ fontSize:12, color:'#666' }}>{c.display_number || '—'} · ID {c.phone_number_id}</div>
                  </div>
                  <button onClick={() => pickBusiness(c.business_id)} style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:'#555', fontWeight:600, fontSize:12, cursor:'pointer' }}>Edit</button>
                  <button onClick={() => disconnect(c.business_id)} style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #fecaca', background:'#fff', color:'#ef4444', fontWeight:600, fontSize:12, cursor:'pointer' }}>Disconnect</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
