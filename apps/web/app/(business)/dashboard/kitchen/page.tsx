// @ts-nocheck
'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { icon: '📊', label: 'Dashboard', href: '/dashboard' },
  { icon: '🚐', label: 'My Vans',   href: '/dashboard/vans' },
  { icon: '📦', label: 'Orders',    href: '/dashboard/orders' },
  { icon: '🧾', label: 'POS',       href: '/dashboard/pos' },
  { icon: '🍳', label: 'Kitchen',   href: '/dashboard/kitchen', active: true },
  { icon: '🎪', label: 'Events',    href: '/van/events' },
  { icon: '📋', label: 'Menu',      href: '/dashboard/menu' },
  { icon: '🧼', label: 'Hygiene',   href: '/dashboard/hygiene' },
  { icon: '💬', label: 'WhatsApp',  href: '/dashboard/whatsapp' },
  { icon: '⚙️', label: 'Settings',  href: '/dashboard/settings' },
]

// Orders the kitchen still needs to make, oldest first — every channel
// (online, guest, WhatsApp, POS) lands here the same way.
const PREP_STATUSES = ['pending', 'accepted', 'preparing']

function elapsedMinutes(createdAt: string) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
}

export default function KitchenDisplayPage() {
  const [loading, setLoading] = useState(true)
  const [biz, setBiz]         = useState<any>(null)
  const [vans, setVans]       = useState<any[]>([])
  const [vanId, setVanId]     = useState<string | null>(null)
  const [orders, setOrders]   = useState<any[]>([])
  const [busyId, setBusyId]   = useState<string | null>(null)
  const [, forceTick]         = useState(0)
  const supabaseRef = useRef<any>(null)

  useEffect(() => {
    const supabase = createClient()
    supabaseRef.current = supabase
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
      const { data: vs } = await supabase.from('vans').select('id, name').eq('business_id', b.id).eq('is_active', true)
      setVans(vs ?? [])
      if (vs?.length) setVanId(vs[0].id)
      setLoading(false)
    })
  }, [])

  const fetchOrders = async (vid: string) => {
    const supabase = supabaseRef.current
    const { data } = await supabase.from('orders')
      .select('*, order_items(*)')
      .eq('van_id', vid).in('status', PREP_STATUSES)
      .order('created_at', { ascending: true })
    setOrders(data ?? [])
  }

  useEffect(() => {
    if (!vanId) return
    fetchOrders(vanId)
    const supabase = supabaseRef.current
    const channel = supabase.channel(`kitchen-${vanId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `van_id=eq.${vanId}` }, () => fetchOrders(vanId))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [vanId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render every 15s so the elapsed-time badges stay current.
  useEffect(() => {
    const t = setInterval(() => forceTick(x => x + 1), 15000)
    return () => clearInterval(t)
  }, [])

  const markReady = async (orderId: string) => {
    setBusyId(orderId)
    await supabaseRef.current.from('orders')
      .update({ status: 'ready', ready_at: new Date().toISOString() })
      .eq('id', orderId)
    setBusyId(null)
  }

  const urgency = (mins: number) => mins >= 10 ? { bg: '#fef2f2', border: '#ef4444', badge: '#ef4444' }
    : mins >= 5 ? { bg: '#fffbeb', border: '#f59e0b', badge: '#f59e0b' }
    : { bg: '#fff', border: '#e5e7eb', badge: '#6b7280' }

  const van = vans.find(v => v.id === vanId)

  return (
    <>
      <style>{`
        html,body{margin:0;padding:0}
        .wrap{display:flex;flex-direction:column;min-height:100vh;background:#f0f1f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        .topbar{background:#fff;border-bottom:1px solid #e5e7eb;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
        .sidebar{width:200px;flex-shrink:0;background:#fff;border-right:1px solid #e5e7eb;padding:16px 10px;min-height:calc(100vh - 56px)}
        .main{flex:1;padding:20px}
        .body{display:flex;flex:1}
        .bottom{display:none;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e5e7eb;z-index:100;padding:8px 10px 18px;overflow-x:auto;-webkit-overflow-scrolling:touch;gap:14px}
        .bottom::-webkit-scrollbar{display:none}
        @media(max-width:800px){.sidebar{display:none}.main{padding:12px;padding-bottom:90px}.bottom{display:flex;justify-content:flex-start}}
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
            <select value={vanId ?? ''} onChange={e => setVanId(e.target.value)} style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13 }}>
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
              <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading…</div>
            ) : vans.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>No active van yet.</div>
            ) : (
              <>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 16px', color: '#111' }}>🍳 Kitchen — {van?.name} <span style={{ fontSize: 14, fontWeight: 600, color: '#888' }}>({orders.length} to make)</span></h1>

                {orders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60, color: '#bbb', fontSize: 16, fontWeight: 600 }}>✅ All caught up — no orders waiting</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
                    {orders.map(o => {
                      const mins = elapsedMinutes(o.created_at)
                      const u = urgency(mins)
                      const items = o.order_items ?? []
                      return (
                        <div key={o.id} style={{ background: u.bg, border: `2px solid ${u.border}`, borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                            <div>
                              <div style={{ fontWeight: 900, fontSize: 18, color: '#111' }}>#{(o.order_number ?? o.id.slice(0, 8)).toUpperCase()}</div>
                              {o.guest_name && <div style={{ fontSize: 13, color: '#666', fontWeight: 600 }}>{o.guest_name}</div>}
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: u.badge, padding: '3px 10px', borderRadius: 12, whiteSpace: 'nowrap' }}>{mins}m</span>
                          </div>

                          <div style={{ flex: 1, marginBottom: 14 }}>
                            {items.length === 0 && <div style={{ color: '#aaa', fontSize: 13 }}>No items recorded</div>}
                            {items.map((it: any, i: number) => (
                              <div key={it.id ?? i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: i < items.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
                                <span style={{ fontWeight: 900, fontSize: 20, color: '#0e7490', minWidth: 30 }}>{it.quantity}×</span>
                                <span style={{ fontWeight: 700, fontSize: 17, color: '#111', lineHeight: 1.3 }}>{it.name}</span>
                              </div>
                            ))}
                          </div>

                          {o.notes && !o.notes.startsWith('Served by') && (
                            <div style={{ fontSize: 12, color: '#b45309', fontStyle: 'italic', marginBottom: 10 }}>📝 {o.notes}</div>
                          )}

                          <button onClick={() => markReady(o.id)} disabled={busyId === o.id}
                            style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: '#059669', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: busyId === o.id ? 0.6 : 1 }}>
                            {busyId === o.id ? 'Marking…' : '✅ Order Ready'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
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
