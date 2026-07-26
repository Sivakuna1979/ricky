// @ts-nocheck
'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { icon: '📊', label: 'Dashboard', href: '/dashboard' },
  { icon: '🚐', label: 'My Vans',   href: '/dashboard/vans' },
  { icon: '📦', label: 'Orders',    href: '/dashboard/orders' },
  { icon: '🧾', label: 'POS',       href: '/dashboard/pos', active: true },
  { icon: '🍳', label: 'Kitchen',   href: '/dashboard/kitchen' },
  { icon: '🎪', label: 'Events',    href: '/van/events' },
  { icon: '📋', label: 'Menu',      href: '/dashboard/menu' },
  { icon: '🧼', label: 'Hygiene',   href: '/dashboard/hygiene' },
  { icon: '💬', label: 'WhatsApp',  href: '/dashboard/whatsapp' },
  { icon: '⚙️', label: 'Settings',  href: '/dashboard/settings' },
]

export default function PosPage() {
  const [loading, setLoading]     = useState(true)
  const [biz, setBiz]             = useState<any>(null)
  const [vans, setVans]           = useState<any[]>([])
  const [vanId, setVanId]         = useState<string | null>(null)
  const [menuItems, setMenuItems] = useState<any[]>([])
  const [menuLoading, setMenuLoading] = useState(false)
  const [category, setCategory]   = useState<string | null>(null)
  const [cart, setCart]           = useState<Record<string, number>>({})
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [servedBy, setServedBy]   = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash_at_van' | 'card_at_van'>('cash_at_van')
  const [cashTendered, setCashTendered] = useState('')
  const [placing, setPlacing]     = useState(false)
  const [error, setError]         = useState('')
  const [lastSale, setLastSale]   = useState<any>(null)
  const [showSales, setShowSales] = useState(false)
  const [recentSales, setRecentSales] = useState<any[]>([])
  const [salesSearch, setSalesSearch] = useState('')
  const [readyOrders, setReadyOrders] = useState<any[]>([])
  const [handingOver, setHandingOver] = useState<string | null>(null)
  const channelRef = useRef<any>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/login'; return }
      const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      let b: any = null
      if (userData?.id) {
        const { data } = await supabase.from('businesses').select('id, name').eq('owner_id', userData.id).maybeSingle()
        b = data
      }
      if (!b) { const { data: r } = await supabase.rpc('get_my_business'); if (r) b = r }
      if (!b) { window.location.href = '/register/business'; return }
      setBiz(b)
      const { data: vs } = await supabase.from('vans')
        .select('id, name, accepts_cash, accepts_card_at_van')
        .eq('business_id', b.id).eq('is_active', true)
      setVans(vs ?? [])
      if (vs?.length) setVanId(vs[0].id)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!vanId) return
    setMenuLoading(true)
    setCart({})
    const supabase = createClient()
    supabase.from('menu_items').select('*').eq('van_id', vanId).eq('available', true)
      .order('category').order('name')
      .then(({ data }) => { setMenuItems(data ?? []); setMenuLoading(false) })
  }, [vanId])

  // Orders the kitchen has finished — waiting for the customer to be handed
  // their food and the sale to actually complete.
  useEffect(() => {
    if (!vanId) return
    const supabase = createClient()
    const fetchReady = () => {
      supabase.from('orders').select('id, order_number, guest_name, total, created_at')
        .eq('van_id', vanId).eq('status', 'ready')
        .order('created_at', { ascending: true })
        .then(({ data }) => setReadyOrders(data ?? []))
    }
    fetchReady()
    const channel = supabase.channel(`pos-ready-${vanId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `van_id=eq.${vanId}` }, fetchReady)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [vanId])

  const handOver = async (orderId: string) => {
    setHandingOver(orderId)
    const supabase = createClient()
    await supabase.from('orders').update({ status: 'collected', collected_at: new Date().toISOString() }).eq('id', orderId)
    setHandingOver(null)
  }

  const loadRecentSales = () => {
    if (!vanId) return
    const supabase = createClient()
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
    supabase.from('orders').select('id, order_number, guest_name, total, created_at, source')
      .eq('van_id', vanId).gte('created_at', startOfToday.toISOString())
      .order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setRecentSales(data ?? []))
  }
  useEffect(() => { if (showSales) loadRecentSales() }, [vanId, showSales]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live broadcast to the customer-facing display screen (public, no auth) —
  // an ephemeral Realtime channel, nothing written to the database.
  useEffect(() => {
    if (!vanId) return
    const supabase = createClient()
    const channel = supabase.channel(`pos-display-${vanId}`)
    channel.subscribe()
    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [vanId]) // eslint-disable-line react-hooks/exhaustive-deps

  const van = vans.find(v => v.id === vanId)
  const categories = useMemo(() => {
    const set = new Set(menuItems.map(i => i.category).filter(Boolean))
    return Array.from(set)
  }, [menuItems])
  const visibleItems = category ? menuItems.filter(i => i.category === category) : menuItems

  const cartLines = menuItems.filter(i => cart[i.id])
  const cartTotal = cartLines.reduce((s, i) => s + i.price * cart[i.id], 0)
  const cartCount = Object.values(cart).reduce((s: number, n: any) => s + n, 0)

  const addItem = (id: string) => setCart(c => ({ ...c, [id]: (c[id] ?? 0) + 1 }))
  const decItem = (id: string) => setCart(c => {
    const n = (c[id] ?? 0) - 1
    const next = { ...c }
    if (n <= 0) delete next[id]; else next[id] = n
    return next
  })

  const tendered = paymentMethod === 'cash_at_van' ? Number(cashTendered) || 0 : null
  const changeDue = tendered != null ? Math.max(0, tendered - cartTotal) : null
  const shortBy = tendered != null && tendered < cartTotal ? cartTotal - tendered : 0

  // Push the live sale state to the customer-facing screen on every change.
  useEffect(() => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'sale_update',
      payload: {
        lines: cartLines.map(i => ({ name: i.name, price: i.price, qty: cart[i.id] })),
        total: cartTotal,
        paymentMethod,
        tendered,
        changeDue,
      },
    })
  }, [cart, cartTotal, paymentMethod, tendered]) // eslint-disable-line react-hooks/exhaustive-deps

  const completeSale = async () => {
    if (!cartLines.length || !vanId) return
    setPlacing(true); setError('')
    try {
      const res = await fetch('/api/orders/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          van_id: vanId,
          payment_method: paymentMethod,
          customer_name: customerName || undefined,
          customer_email: customerEmail || undefined,
          served_by: servedBy || undefined,
          cash_tendered: paymentMethod === 'cash_at_van' ? tendered ?? undefined : undefined,
          items: cartLines.map(i => ({ menu_item_id: i.id, name: i.name, price: i.price, quantity: cart[i.id], item_total: i.price * cart[i.id] })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error?.formErrors?.join?.(', ') ?? data.error ?? 'Could not complete the sale'); setPlacing(false); return }
      setLastSale({ id: data.id, order_number: data.order_number, total: cartTotal, count: cartCount })
      setRecentSales(s => [{ id: data.id, order_number: data.order_number, guest_name: data.guest_name, total: cartTotal, created_at: data.created_at, source: 'pos' }, ...s])
      channelRef.current?.send({
        type: 'broadcast', event: 'sale_complete',
        payload: { order_number: data.order_number, total: cartTotal, changeDue },
      })
      setCart({}); setCustomerName(''); setCustomerEmail(''); setCashTendered('')
    } catch {
      setError('Network error — please try again')
    }
    setPlacing(false)
  }

  const inp = { padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }

  return (
    <>
      <style>{`
        html,body{margin:0;padding:0}
        .wrap{display:flex;flex-direction:column;min-height:100vh;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        .topbar{background:#fff;border-bottom:1px solid #e5e7eb;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
        .sidebar{width:200px;flex-shrink:0;background:#fff;border-right:1px solid #e5e7eb;padding:16px 10px;min-height:calc(100vh - 56px)}
        .main{flex:1;padding:20px;display:flex;gap:20px;align-items:flex-start}
        .body{display:flex;flex:1}
        .bottom{display:none;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e5e7eb;z-index:100;padding:8px 10px 18px;overflow-x:auto;-webkit-overflow-scrolling:touch;gap:14px}
        .bottom::-webkit-scrollbar{display:none}
        @media(max-width:800px){.sidebar{display:none}.main{padding:12px;padding-bottom:90px;flex-direction:column}.bottom{display:flex;justify-content:flex-start}}
      `}</style>
      <div className="wrap">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#f97316,#dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#fff' }}>FT</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#111', lineHeight: 1 }}>FoodTaxi</div>
              {biz?.name && <div style={{ fontSize: 11, color: '#888' }}>{biz.name}</div>}
            </div>
          </div>
          {vans.length > 1 && (
            <select value={vanId ?? ''} onChange={e => setVanId(e.target.value)} style={{ ...inp, padding: '6px 10px', fontSize: 13 }}>
              {vans.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          )}
        </div>
        <div className="body">
          <div className="sidebar">
            {NAV.map(n => (
              <a key={n.href} href={n.href} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 10, marginBottom: 3, fontSize: 14, fontWeight: 600, textDecoration: 'none', color: n.active ? '#f97316' : '#555', background: n.active ? '#fff7ed' : 'transparent', border: n.active ? '1px solid #fed7aa' : '1px solid transparent' }}>
                <span style={{ fontSize: 16 }}>{n.icon}</span>{n.label}
              </a>
            ))}
          </div>

          <div className="main">
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#888', width: '100%' }}>Loading…</div>
            ) : vans.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#888', width: '100%' }}>
                No active van yet. <a href="/dashboard/vans/new" style={{ color: '#f97316', fontWeight: 700 }}>Add a van</a> before taking POS sales.
              </div>
            ) : (
              <>
                {/* ── Menu grid ── */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {readyOrders.length > 0 && (
                    <div style={{ background: '#ecfdf5', border: '2px solid #10b981', borderRadius: 14, padding: 14, marginBottom: 14 }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#065f46', marginBottom: 8 }}>🔔 Ready for Pickup — {readyOrders.length}</div>
                      {readyOrders.map(o => (
                        <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(16,185,129,0.2)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontWeight: 800, fontSize: 13, color: '#111' }}>#{(o.order_number ?? o.id.slice(0, 8)).toUpperCase()}</span>
                            {o.guest_name && <span style={{ fontSize: 12, color: '#666' }}> · {o.guest_name}</span>}
                            <span style={{ fontSize: 12, color: '#666' }}> · £{Number(o.total).toFixed(2)}</span>
                          </div>
                          <button onClick={() => handOver(o.id)} disabled={handingOver === o.id}
                            style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: handingOver === o.id ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                            {handingOver === o.id ? '…' : '✅ Hand Over'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#111' }}>🧾 Till — {van?.name}</h1>
                    <button onClick={() => setShowSales(v => !v)}
                      style={{ padding: '7px 14px', borderRadius: 10, border: '1px solid #e5e7eb', background: showSales ? '#ecfeff' : '#fff', color: '#0e7490', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      🧾 Sales & Receipts {showSales ? '▲' : '▼'}
                    </button>
                  </div>

                  {showSales && (
                    <div style={{ background: '#fff', borderRadius: 14, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: '#111', marginBottom: 10 }}>Today's Sales — {recentSales.length}</div>
                      <input value={salesSearch} onChange={e => setSalesSearch(e.target.value)} placeholder="Search by name or order #"
                        style={{ ...inp, width: '100%', marginBottom: 10 }} />
                      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                        {recentSales.length === 0 && <div style={{ color: '#bbb', fontSize: 13, padding: '10px 0' }}>No sales yet today.</div>}
                        {recentSales
                          .filter(s => {
                            const q = salesSearch.trim().toLowerCase()
                            if (!q) return true
                            return (s.guest_name ?? '').toLowerCase().includes(q) || (s.order_number ?? '').toLowerCase().includes(q)
                          })
                          .map(s => (
                            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #f3f4f6' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
                                  #{(s.order_number ?? s.id.slice(0, 8)).toUpperCase()}
                                  {s.source === 'pos' && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, color: '#0e7490', background: '#ecfeff', padding: '1px 6px', borderRadius: 8 }}>TILL</span>}
                                </div>
                                <div style={{ fontSize: 11, color: '#999' }}>
                                  {s.guest_name ? `${s.guest_name} · ` : ''}{new Date(s.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                              <div style={{ fontWeight: 800, fontSize: 13, color: '#111' }}>£{Number(s.total).toFixed(2)}</div>
                              <a href={`/receipt/${s.id}`} target="_blank" rel="noopener noreferrer"
                                style={{ padding: '6px 12px', borderRadius: 8, background: '#0e7490', color: '#fff', fontWeight: 700, fontSize: 11, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                                🖨️ Receipt
                              </a>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {categories.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                      <button onClick={() => setCategory(null)} style={{ padding: '6px 14px', borderRadius: 16, border: category === null ? '2px solid #0e7490' : '1px solid #e5e7eb', background: category === null ? '#ecfeff' : '#fff', color: category === null ? '#0e7490' : '#555', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>All</button>
                      {categories.map(c => (
                        <button key={c} onClick={() => setCategory(c)} style={{ padding: '6px 14px', borderRadius: 16, border: category === c ? '2px solid #0e7490' : '1px solid #e5e7eb', background: category === c ? '#ecfeff' : '#fff', color: category === c ? '#0e7490' : '#555', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{c}</button>
                      ))}
                    </div>
                  )}

                  {menuLoading ? (
                    <div style={{ color: '#999', padding: 20 }}>Loading menu…</div>
                  ) : visibleItems.length === 0 ? (
                    <div style={{ color: '#999', padding: 20 }}>No available menu items. Add some in <a href="/dashboard/menu" style={{ color: '#f97316' }}>Menu</a>.</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
                      {visibleItems.map(item => (
                        <button key={item.id} onClick={() => addItem(item.id)}
                          style={{ textAlign: 'left', padding: '14px', borderRadius: 14, border: cart[item.id] ? '2px solid #0e7490' : '1px solid #e5e7eb', background: cart[item.id] ? '#ecfeff' : '#fff', cursor: 'pointer', position: 'relative' }}>
                          {cart[item.id] > 0 && (
                            <span style={{ position: 'absolute', top: 8, right: 8, background: '#0e7490', color: '#fff', borderRadius: 999, minWidth: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, padding: '0 6px' }}>{cart[item.id]}</span>
                          )}
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#111', marginBottom: 4 }}>{item.name}</div>
                          <div style={{ fontWeight: 800, fontSize: 15, color: '#0e7490' }}>£{Number(item.price).toFixed(2)}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Cart / checkout ── */}
                <div style={{ width: 340, flexShrink: 0, background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', position: 'sticky', top: 76 }}>
                  {lastSale ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                      <div style={{ fontSize: 40, marginBottom: 10 }}>🍳</div>
                      <div style={{ fontWeight: 800, fontSize: 17, color: '#059669', marginBottom: 4 }}>Payment taken — now preparing</div>
                      <div style={{ fontSize: 13, color: '#666', marginBottom: 2 }}>Order #{lastSale.order_number}</div>
                      <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>It'll show on the Kitchen screen, then land in "Ready for Pickup" above once made.</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#111', margin: '10px 0' }}>£{lastSale.total.toFixed(2)}</div>
                      {lastSale.id && (
                        <a href={`/receipt/${lastSale.id}`} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'block', padding: '11px', borderRadius: 10, border: '1px solid #e5e7eb', color: '#0e7490', fontWeight: 700, fontSize: 13, textDecoration: 'none', marginBottom: 8 }}>
                          🧾 View / Print / Email Receipt
                        </a>
                      )}
                      <button onClick={() => {
                        setLastSale(null)
                        channelRef.current?.send({ type: 'broadcast', event: 'sale_update', payload: { lines: [], total: 0, paymentMethod: 'cash_at_van', tendered: null, changeDue: null } })
                      }} style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: '#0e7490', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                        🧾 New Sale
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontWeight: 800, fontSize: 15, color: '#111', marginBottom: 10 }}>Current Sale</div>
                      {cartLines.length === 0 ? (
                        <div style={{ color: '#bbb', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Tap items to add them</div>
                      ) : (
                        <div style={{ marginBottom: 12, maxHeight: 260, overflowY: 'auto' }}>
                          {cartLines.map(item => (
                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f3f4f6' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                                <div style={{ fontSize: 11, color: '#999' }}>£{(item.price * cart[item.id]).toFixed(2)}</div>
                              </div>
                              <button onClick={() => decItem(item.id)} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 800 }}>−</button>
                              <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{cart[item.id]}</span>
                              <button onClick={() => addItem(item.id)} style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: '#0e7490', color: '#fff', cursor: 'pointer', fontWeight: 800 }}>+</button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, padding: '10px 0', borderTop: '2px solid #f3f4f6', marginBottom: 12 }}>
                        <span>Total</span><span>£{cartTotal.toFixed(2)}</span>
                      </div>

                      <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name (optional)" style={{ ...inp, width: '100%', marginBottom: 8 }} />
                      <input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} type="email" placeholder="Email — for emailed receipt (optional)" style={{ ...inp, width: '100%', marginBottom: 8 }} />
                      <input value={servedBy} onChange={e => setServedBy(e.target.value)} placeholder="Served by (optional)" style={{ ...inp, width: '100%', marginBottom: 10 }} />

                      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <button onClick={() => setPaymentMethod('cash_at_van')} style={{ flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13, border: paymentMethod === 'cash_at_van' ? '2px solid #0e7490' : '1px solid #e5e7eb', background: paymentMethod === 'cash_at_van' ? '#ecfeff' : '#fff', color: paymentMethod === 'cash_at_van' ? '#0e7490' : '#555' }}>💷 Cash</button>
                        <button onClick={() => setPaymentMethod('card_at_van')} style={{ flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13, border: paymentMethod === 'card_at_van' ? '2px solid #0e7490' : '1px solid #e5e7eb', background: paymentMethod === 'card_at_van' ? '#ecfeff' : '#fff', color: paymentMethod === 'card_at_van' ? '#0e7490' : '#555' }}>💳 Card</button>
                      </div>

                      {paymentMethod === 'cash_at_van' && (
                        <div style={{ marginBottom: 12 }}>
                          <input type="number" step="0.01" inputMode="decimal" value={cashTendered} onChange={e => setCashTendered(e.target.value)}
                            placeholder="Cash received" style={{ ...inp, width: '100%', fontSize: 16, fontWeight: 700, textAlign: 'center' }} />
                          {cashTendered !== '' && (
                            shortBy > 0 ? (
                              <div style={{ marginTop: 6, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#b45309' }}>£{shortBy.toFixed(2)} short</div>
                            ) : (
                              <div style={{ marginTop: 6, textAlign: 'center', fontSize: 14, fontWeight: 800, color: '#059669' }}>Change due: £{(changeDue ?? 0).toFixed(2)}</div>
                            )
                          )}
                        </div>
                      )}

                      {error && <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 700, marginBottom: 8 }}>⚠️ {error}</div>}

                      <button onClick={completeSale} disabled={!cartLines.length || placing || (paymentMethod === 'cash_at_van' && shortBy > 0)}
                        style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: '#059669', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: (!cartLines.length || placing || (paymentMethod === 'cash_at_van' && shortBy > 0)) ? 0.5 : 1 }}>
                        {placing ? 'Processing…' : `✅ Complete Sale · £${cartTotal.toFixed(2)}`}
                      </button>

                      {vanId && (
                        <a href={`/pos-display/${vanId}`} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'block', textAlign: 'center', marginTop: 10, fontSize: 12, fontWeight: 700, color: '#6366f1', textDecoration: 'none' }}>
                          📺 Open Customer Display (second screen)
                        </a>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <nav className="bottom">
          {NAV.map(n => (
            <a key={n.href} href={n.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textDecoration: 'none', color: n.active ? '#f97316' : '#9ca3af', fontSize: 10, fontWeight: 600, minWidth: 56, flexShrink: 0, padding: '2px 4px' }}>
              <span style={{ fontSize: 20 }}>{n.icon}</span>{n.label}
            </a>
          ))}
        </nav>
      </div>
    </>
  )
}
