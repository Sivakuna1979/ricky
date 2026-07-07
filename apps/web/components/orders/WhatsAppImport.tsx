// @ts-nocheck
'use client'
import { useState } from 'react'

export function WhatsAppImport({ vanId, businessId }: any) {
  const [open, setOpen]       = useState(false)
  const [tab, setTab]         = useState('text') // text | image
  const [text, setText]       = useState('')
  const [image, setImage]     = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [order, setOrder]     = useState<any>(null)
  const [error, setError]     = useState('')
  const [saved, setSaved]     = useState(false)
  const [saving, setSaving]   = useState(false)

  const pickImage = (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const MAX = 1400
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        const jpeg = canvas.toDataURL('image/jpeg', 0.85)
        setImage({ data: jpeg.split(',')[1], mediaType: 'image/jpeg', preview: jpeg })
        setError('')
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const parse = async () => {
    setLoading(true)
    setError('')
    setOrder(null)
    setSaved(false)
    try {
      const body: any = { van_id: vanId }
      if (tab === 'text') body.text = text
      else body.image = { data: image.data, mediaType: image.mediaType }
      const res = await fetch('/api/ai/parse-whatsapp-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }))
      if (!res.ok || data.error) { setError(data.error ?? 'Could not read the order'); setLoading(false); return }
      setOrder(data.order)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  const setItem = (idx: number, patch: any) => {
    setOrder((o: any) => ({ ...o, items: o.items.map((it: any, i: number) => i === idx ? { ...it, ...patch } : it) }))
  }
  const removeItem = (idx: number) => {
    setOrder((o: any) => ({ ...o, items: o.items.filter((_: any, i: number) => i !== idx) }))
  }
  const total = order ? order.items.reduce((s: number, i: any) => s + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0) : 0

  const save = async () => {
    if (!order?.items?.length) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/orders/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        van_id: vanId,
        business_id: businessId,
        customer_name: order.customer_name || 'WhatsApp customer',
        customer_phone: order.customer_phone || 'via WhatsApp',
        notes: `[WhatsApp order]${order.notes ? ' ' + order.notes : ''}`,
        pickup_location: order.pickup_location || null,
        pickup_time: order.pickup_time || null,
        items: order.items.map((i: any) => ({ menu_item_id: i.menu_item_id, name: i.name, price: Number(i.price) || 0, quantity: Number(i.quantity) || 1, item_total: (Number(i.price) || 0) * (Number(i.quantity) || 1) })),
        subtotal: total,
        total,
        payment_method: 'cash_at_van',
      }),
    })
    const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }))
    if (!res.ok || data.error) { setError(data.error ?? 'Could not save the order'); setSaving(false); return }
    setSaved(true)
    setSaving(false)
    setOrder(null)
    setText('')
    setImage(null)
    setTimeout(() => window.location.reload(), 1200)
  }

  const inp = { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:13, outline:'none', boxSizing:'border-box' as const, fontFamily:'inherit' }

  return (
    <div style={{ background:'linear-gradient(135deg,#128c7e,#25d366)', borderRadius:14, padding:16, marginBottom:20, boxShadow:'0 2px 8px rgba(18,140,126,0.25)' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
        <div>
          <div style={{ fontWeight:800, fontSize:15, color:'#fff' }}>💬 Import WhatsApp Order — AI</div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.85)' }}>Paste the customer's message or a screenshot — AI adds it to your orders</div>
        </div>
        <span style={{ color:'#fff', fontSize:18 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ marginTop:14 }}>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <button onClick={() => setTab('text')} style={{ flex:1, padding:'9px', borderRadius:9, border:'none', cursor:'pointer', fontWeight:700, fontSize:13, background: tab === 'text' ? '#fff' : 'rgba(255,255,255,0.2)', color: tab === 'text' ? '#128c7e' : '#fff' }}>⌨️ Paste Message</button>
            <button onClick={() => setTab('image')} style={{ flex:1, padding:'9px', borderRadius:9, border:'none', cursor:'pointer', fontWeight:700, fontSize:13, background: tab === 'image' ? '#fff' : 'rgba(255,255,255,0.2)', color: tab === 'image' ? '#128c7e' : '#fff' }}>📷 Screenshot</button>
          </div>

          {tab === 'text' && (
            <textarea value={text} onChange={e => setText(e.target.value)} rows={4}
              placeholder={'Paste the WhatsApp message here, e.g.\n"Hi can I get 2 cod and chips and a large chips, pick up at Tesco\'s about 7:30, John"'}
              style={{ ...inp, resize:'vertical', marginBottom:10 }} />
          )}
          {tab === 'image' && (
            image ? (
              <div style={{ marginBottom:10 }}>
                <img src={image.preview} alt="chat" style={{ maxWidth:'100%', maxHeight:160, borderRadius:10, display:'block', marginBottom:6 }} />
                <button onClick={() => setImage(null)} style={{ padding:'6px 12px', borderRadius:8, border:'none', background:'rgba(255,255,255,0.25)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>Change</button>
              </div>
            ) : (
              <label style={{ display:'block', textAlign:'center', padding:'18px', borderRadius:10, border:'2px dashed rgba(255,255,255,0.5)', cursor:'pointer', marginBottom:10, color:'#fff', fontWeight:700, fontSize:13 }}>
                🖼️ Tap to choose the chat screenshot
                <input type="file" accept="image/*" onChange={pickImage} style={{ display:'none' }} />
              </label>
            )
          )}

          <button onClick={parse} disabled={loading || (tab === 'text' ? !text.trim() : !image)}
            style={{ width:'100%', padding:'11px', borderRadius:10, border:'none', background:'#fff', color:'#128c7e', fontWeight:800, fontSize:14, cursor:'pointer', opacity: (loading || (tab === 'text' ? !text.trim() : !image)) ? 0.55 : 1 }}>
            {loading ? '🤖 Reading order…' : '✨ Read Order with AI'}
          </button>

          {order && (
            <div style={{ background:'#fff', borderRadius:12, padding:14, marginTop:12 }}>
              <div style={{ fontSize:12, fontWeight:800, color:'#128c7e', marginBottom:8 }}>CHECK & EDIT, THEN ADD</div>
              {order.items.map((it: any, i: number) => (
                <div key={i} style={{ display:'flex', gap:6, alignItems:'center', marginBottom:6 }}>
                  <input type="number" min="1" value={it.quantity} onChange={e => setItem(i, { quantity: Number(e.target.value) })} style={{ ...inp, width:52, textAlign:'center' }} />
                  <input value={it.name} onChange={e => setItem(i, { name: e.target.value })} style={{ ...inp, flex:1 }} />
                  <input type="number" step="0.5" value={it.price} onChange={e => setItem(i, { price: Number(e.target.value) })} style={{ ...inp, width:70 }} />
                  <button onClick={() => removeItem(i)} style={{ background:'none', border:'none', color:'#ef4444', fontSize:16, cursor:'pointer' }}>×</button>
                </div>
              ))}
              <div style={{ display:'flex', gap:6, marginTop:10 }}>
                <input value={order.customer_name ?? ''} onChange={e => setOrder(o => ({ ...o, customer_name: e.target.value }))} placeholder="Customer name" style={{ ...inp, flex:1 }} />
                <input value={order.customer_phone ?? ''} onChange={e => setOrder(o => ({ ...o, customer_phone: e.target.value }))} placeholder="Phone" style={{ ...inp, flex:1 }} />
              </div>
              <div style={{ display:'flex', gap:6, marginTop:6 }}>
                <input value={order.pickup_location ?? ''} onChange={e => setOrder(o => ({ ...o, pickup_location: e.target.value }))} placeholder="Pickup spot" style={{ ...inp, flex:1 }} />
                <input value={order.pickup_time ?? ''} onChange={e => setOrder(o => ({ ...o, pickup_time: e.target.value }))} placeholder="Time" style={{ ...inp, width:90 }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontWeight:900, fontSize:15, color:'#111', margin:'12px 0' }}>
                <span>Total</span><span>£{total.toFixed(2)}</span>
              </div>
              <button onClick={save} disabled={saving || !order.items.length}
                style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:'#128c7e', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Adding…' : '✓ Add to Orders'}
              </button>
            </div>
          )}

          {saved && <div style={{ marginTop:10, fontSize:13, fontWeight:800, color:'#fff' }}>✅ Order added!</div>}
          {error && <div style={{ marginTop:10, fontSize:13, fontWeight:700, color:'#ffd7d7' }}>⚠️ {error}</div>}
        </div>
      )}
    </div>
  )
}
