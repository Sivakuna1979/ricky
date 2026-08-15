// @ts-nocheck
'use client'
import { useState } from 'react'

const STATUS_COLORS = {
  pending:    { bg:'#fef3c7', color:'#92400e' },
  accepted:   { bg:'#dbeafe', color:'#1e40af' },
  preparing:  { bg:'#ede9fe', color:'#5b21b6' },
  ready:      { bg:'#d1fae5', color:'#065f46' },
  collected:  { bg:'#f0fdf4', color:'#166534' },
  cancelled:  { bg:'#fee2e2', color:'#991b1b' },
}

export function OrderManageRow({ order, vanName, isLast, isSuperAdmin }: any) {
  const [open, setOpen]       = useState(false)
  const [status, setStatus]   = useState(order.status)
  const [payment, setPayment] = useState(order.payment_method ?? 'cash_at_van')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')
  const [smsNote, setSmsNote] = useState('')
  const [deleted, setDeleted] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const deleteForever = async () => {
    const ref = (order.order_number ?? order.id.slice(0, 8)).toUpperCase()
    if (!confirm(`Permanently delete order #${ref}? This cannot be undone and leaves no record — only use this for test data, never real orders.`)) return
    setDeleting(true)
    const res = await fetch(`/api/orders/${order.id}`, { method: 'DELETE' })
    if (res.ok) setDeleted(true)
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? 'Delete failed') }
    setDeleting(false)
  }

  const update = async (fields: any) => {
    setBusy(true)
    setError('')
    const res = await fetch('/api/orders/manage', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: order.id, ...fields }),
    })
    const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }))
    if (!res.ok || data.error) { setError(data.error ?? 'Update failed'); setBusy(false); return false }
    if (data.sms === 'sent') setSmsNote('📱 Text sent to customer')
    else if (data.sms === 'not_configured') setSmsNote('ℹ️ SMS not set up yet — customer was not texted')
    else if (String(data.sms ?? '').startsWith('sms_failed')) setSmsNote(`⚠️ Text failed: ${data.sms.replace('sms_failed: ', '')}`)
    else setSmsNote('')
    setBusy(false)
    return true
  }

  const complete = async () => {
    if (await update({ status: 'collected', payment_method: payment })) setStatus('collected')
  }
  const markReady = async () => {
    if (await update({ status: 'ready' })) setStatus('ready')
  }
  const cancel = async () => {
    if (!confirm(`Cancel order #${(order.order_number ?? order.id.slice(0,8)).toUpperCase()}?`)) return
    if (await update({ status: 'cancelled' })) setStatus('cancelled')
  }

  const s = STATUS_COLORS[status] ?? { bg:'#f3f4f6', color:'#555' }
  const items = order.order_items ?? []
  const active = ['pending', 'accepted', 'preparing', 'ready'].includes(status)

  // Free notification: open WhatsApp / Messages on the owner's phone with the
  // message pre-written — sending costs nothing.
  const ref = (order.order_number ?? order.id.slice(0, 8)).toUpperCase()
  const firstName = (order.guest_name ?? '').split(' ')[0]
  const readyMsg = `Hi${firstName ? ` ${firstName}` : ''}! Your order #${ref} is READY to collect${order.pickup_location ? ` at ${order.pickup_location}` : ''}. See you soon! 🍟`
  const waPhone = (order.guest_phone ?? '').replace(/[^\d]/g, '').replace(/^0/, '44')
  const waLink = `https://wa.me/${waPhone}?text=${encodeURIComponent(readyMsg)}`
  const smsLink = `sms:${order.guest_phone}?&body=${encodeURIComponent(readyMsg)}`

  if (deleted) {
    return (
      <div style={{ borderBottom: isLast ? 'none' : '1px solid #f3f4f6', padding:'10px 18px', fontSize:12, color:'#aaa', fontStyle:'italic' }}>
        Order #{ref} deleted
      </div>
    )
  }

  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid #f3f4f6' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 18px', cursor:'pointer', flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:14, color:'#111' }}>
            Order #{(order.order_number ?? order.id.slice(0,8)).toUpperCase()}
            {order.source === 'pos' && <span style={{ marginLeft:6, fontSize:10, fontWeight:800, color:'#0e7490', background:'#ecfeff', padding:'2px 7px', borderRadius:10 }}>🧾 TILL</span>}
            <span style={{ color:'#c4c9d4', fontWeight:400, marginLeft:6, fontSize:12 }}>{open ? '▲' : '▼'}</span>
          </div>
          <div style={{ fontSize:12, color:'#888', marginTop:2 }}>
            {order.guest_name ? `${order.guest_name} · ` : ''}{vanName || 'Van'} · {new Date(order.created_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}
          </div>
        </div>
        {order.checked_in_at && ['pending', 'accepted', 'preparing'].includes(status) && (
          <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:800, background:'#dcfce7', color:'#166534', flexShrink:0 }}>🚗 Checked in</span>
        )}
        <span style={{ padding:'3px 12px', borderRadius:20, fontSize:12, fontWeight:700, background:s.bg, color:s.color, flexShrink:0 }}>{status}</span>
        <span style={{ fontWeight:800, fontSize:16, color:'#111', flexShrink:0 }}>£{(order.total ?? 0).toFixed(2)}</span>
      </div>

      {open && (
        <div style={{ padding:'0 18px 16px', background:'#fafbfc' }}>
          {/* Customer + pickup details */}
          <div style={{ paddingTop:12, display:'flex', flexDirection:'column', gap:4, marginBottom:10 }}>
            {order.guest_name && <div style={{ fontSize:13, color:'#111' }}>👤 <b>{order.guest_name}</b></div>}
            {order.guest_phone && <a href={`tel:${order.guest_phone}`} style={{ fontSize:13, color:'#2563eb', textDecoration:'none', fontWeight:600 }}>📞 {order.guest_phone}</a>}
            {order.pickup_location && <div style={{ fontSize:13, color:'#ea580c', fontWeight:600 }}>📍 {order.pickup_location}{order.pickup_time ? ` · ~${order.pickup_time}` : ''}</div>}
            {order.notes && <div style={{ fontSize:12, color:'#666', fontStyle:'italic' }}>📝 {order.notes}</div>}
          </div>

          {/* Items */}
          {items.length > 0 && (
            <div style={{ background:'#fff', borderRadius:10, border:'1px solid #eef0f3', padding:'10px 14px', marginBottom:12 }}>
              {items.map((it: any, i: number) => (
                <div key={it.id ?? i} style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#333', padding:'3px 0' }}>
                  <span>× {it.quantity} {it.name}</span>
                  <span style={{ fontWeight:700 }}>£{(it.item_total ?? it.price * it.quantity ?? 0).toFixed(2)}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, fontWeight:800, color:'#111', borderTop:'1px solid #f3f4f6', marginTop:6, paddingTop:8 }}>
                <span>Total</span><span>£{(order.total ?? 0).toFixed(2)}</span>
              </div>
            </div>
          )}

          <a href={`/receipt/${order.id}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            style={{ display:'inline-block', fontSize:12, fontWeight:700, color:'#0e7490', textDecoration:'none', marginBottom:12 }}>
            🧾 View / Print / Email Receipt
          </a>

          {/* Payment + actions */}
          {active && (
            <>
              <div style={{ fontSize:11, fontWeight:700, color:'#888', marginBottom:6 }}>PAYMENT TYPE</div>
              <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                {[{ v:'cash_at_van', l:'💵 Cash' }, { v:'card_at_van', l:'💳 Card' }].map(p => (
                  <button key={p.v} onClick={() => setPayment(p.v)}
                    style={{ flex:1, padding:'10px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700,
                      border: payment === p.v ? '2px solid #f97316' : '1px solid #e5e7eb',
                      background: payment === p.v ? '#fff7ed' : '#fff',
                      color: payment === p.v ? '#ea580c' : '#666' }}>
                    {p.l}
                  </button>
                ))}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {status === 'pending' && (
                  <button onClick={markReady} disabled={busy}
                    style={{ flex:1, padding:'12px', borderRadius:10, border:'none', background:'#0ea5e9', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', opacity: busy ? 0.6 : 1 }}>
                    🔔 Ready
                  </button>
                )}
                <button onClick={complete} disabled={busy}
                  style={{ flex:2, padding:'12px', borderRadius:10, border:'none', background:'#10b981', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', opacity: busy ? 0.6 : 1 }}>
                  {busy ? '…' : '✓ Complete Order'}
                </button>
                <button onClick={cancel} disabled={busy}
                  style={{ padding:'12px 14px', borderRadius:10, border:'1px solid #fecaca', background:'#fff', color:'#ef4444', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  ✕ Cancel
                </button>
              </div>
            </>
          )}
          {status === 'collected' && (
            <div style={{ fontSize:13, fontWeight:700, color:'#059669' }}>✅ Completed{order.payment_method || payment ? ` · paid by ${(order.payment_method ?? payment) === 'card_at_van' ? 'card' : 'cash'}` : ''}</div>
          )}
          {status === 'cancelled' && (
            <div style={{ fontSize:13, fontWeight:700, color:'#991b1b' }}>✕ Cancelled</div>
          )}
          {/* Free notify options — send from your own phone */}
          {order.guest_phone && (status === 'ready' || status === 'pending') && (
            <div style={{ display:'flex', gap:8, marginTop:10, alignItems:'center' }}>
              <span style={{ fontSize:11, fontWeight:700, color:'#888' }}>NOTIFY FREE:</span>
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                style={{ flex:1, textAlign:'center', padding:'9px', borderRadius:10, background:'#25d366', color:'#fff', fontWeight:800, fontSize:13, textDecoration:'none' }}>
                💬 WhatsApp
              </a>
              <a href={smsLink}
                style={{ flex:1, textAlign:'center', padding:'9px', borderRadius:10, background:'#0ea5e9', color:'#fff', fontWeight:800, fontSize:13, textDecoration:'none' }}>
                💬 Text (SMS)
              </a>
            </div>
          )}
          {smsNote && <div style={{ fontSize:13, fontWeight:700, color: smsNote.startsWith('📱') ? '#059669' : '#b45309', marginTop:8 }}>{smsNote}</div>}
          {error && <div style={{ fontSize:13, fontWeight:700, color:'#ef4444', marginTop:8 }}>⚠️ {error}</div>}

          {isSuperAdmin && (
            <div style={{ marginTop:16, paddingTop:12, borderTop:'1px dashed #e5e7eb' }}>
              <button onClick={deleteForever} disabled={deleting}
                style={{ fontSize:11, fontWeight:700, color:'#ef4444', background:'none', border:'1px solid #fecaca', borderRadius:8, padding:'6px 12px', cursor:'pointer', opacity: deleting ? 0.6 : 1 }}>
                {deleting ? 'Deleting…' : '🗑 Delete Permanently (Admin — test data only)'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
