// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const CAT_ORDER = ['Fish','Chips','Burgers','Chicken','Vegetarian','Sides','Extras','Drinks','Desserts','Specials','Mains','Starters']
const TYPE_EMOJI: Record<string, string> = {
  fish_and_chips:'🐟', burger:'🍔', pizza:'🍕', coffee:'☕',
  ice_cream:'🍦', kebab:'🥙', street_food:'🌮', catering_trailer:'🚐',
  bakery:'🥖', fast_food:'🍟', other:'🍽️',
}

export default function VanProfilePage({ params }: { params: { slug: string } }) {
  const [data, setData]           = useState<any>(null)
  const [schedule, setSchedule]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [cart, setCart]           = useState<Record<string, number>>({})
  const [view, setView]           = useState<'menu'|'checkout'|'done'>('menu')
  const [form, setForm]           = useState({ name:'', phone:'', notes:'' })
  const [pickupStop, setPickupStop] = useState<any>(null)
  const [pickupTime, setPickupTime] = useState('')
  const [pickupDayOffset, setPickupDayOffset] = useState(0) // 0=today, 1=tomorrow, ...
  const [schedViewDay, setSchedViewDay] = useState(0)       // day offset shown in the public schedule

  // Next 7 days: label + weekday index (0=Mon..6=Sun) + date string
  const pickupDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const dow = (d.getDay() + 6) % 7
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'short' })
    const dateLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    return { offset: i, dow, label, dateLabel }
  })
  const selectedPickupDay = pickupDays[pickupDayOffset]
  const [placing, setPlacing]     = useState(false)
  const [orderNum, setOrderNum]   = useState('')

  useEffect(() => {
    fetch(`/api/van-profile/${params.slug}`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        setSchedule(Array.isArray(d?.schedule) ? d.schedule : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [params.slug])

  // Apply the van's own brand colours (captured by AI from their design).
  // Falls back to FoodTaxi orange when no brand is set.
  const brand = data?.vans?.[0]?.brand
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--brand', brand?.primary ?? '#f97316')
    root.style.setProperty('--brand2', brand?.secondary ?? '#ea580c')
    root.style.setProperty('--accent', brand?.accent ?? '#fdba74')
    return () => {
      root.style.removeProperty('--brand')
      root.style.removeProperty('--brand2')
      root.style.removeProperty('--accent')
    }
  }, [brand])

  const addToCart = (id: string) => setCart(c => ({ ...c, [id]: (c[id] ?? 0) + 1 }))
  const removeFromCart = (id: string) => setCart(c => {
    const next = { ...c }
    if ((next[id] ?? 0) <= 1) delete next[id]
    else next[id]--
    return next
  })

  const cartItems = data?.menuItems?.filter((i: any) => cart[i.id]) ?? []
  const cartTotal = cartItems.reduce((s: number, i: any) => s + i.price * (cart[i.id] ?? 0), 0)
  const cartCount = Object.values(cart).reduce((s: number, n) => s + (n as number), 0)

  const placeOrder = async () => {
    if (!form.name || !form.phone) return
    setPlacing(true)
    const pickupDayLabel = pickupDayOffset === 0 ? '' : ` on ${selectedPickupDay.label} ${selectedPickupDay.dateLabel}`
    const pickupNote = pickupStop
      ? `Pickup: ${pickupStop.location_name}${pickupDayLabel}${pickupTime ? ` around ${pickupTime}` : ''}`
      : ''
    const combinedNotes = [pickupNote, form.notes].filter(Boolean).join(' — ')
    const res = await fetch('/api/orders/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        van_id: data.vans?.[0]?.id,
        business_id: data.business?.id,
        customer_name: form.name,
        customer_phone: form.phone,
        notes: combinedNotes || null,
        pickup_location: pickupStop?.location_name ?? null,
        pickup_time: pickupTime ? `${pickupDayOffset === 0 ? '' : `${selectedPickupDay.label} ${selectedPickupDay.dateLabel} `}${pickupTime}` : (pickupDayOffset === 0 ? null : `${selectedPickupDay.label} ${selectedPickupDay.dateLabel}`),
        items: cartItems.map((i: any) => ({ menu_item_id: i.id, name: i.name, price: i.price, quantity: cart[i.id], item_total: i.price * cart[i.id] })),
        subtotal: cartTotal,
        total: cartTotal,
        payment_method: 'cash_at_van',
      }),
    })
    const json = await res.json()
    setPlacing(false)
    if (res.ok) { setOrderNum(json.order_number ?? json.id?.slice(0,8).toUpperCase() ?? 'OK'); setView('done') }
    else alert(json.error ?? 'Failed to place order')
  }

  if (loading) return (
    <div style={{ background:'#080c18', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:'system-ui,sans-serif' }}>
      Loading…
    </div>
  )

  if (!data?.business) return (
    <div style={{ background:'#080c18', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:'system-ui,sans-serif', gap:16 }}>
      <div style={{ fontSize:48 }}>🍽️</div>
      <div style={{ fontSize:20, fontWeight:800 }}>Business Not Found</div>
      <a href="/" style={{ color:'var(--brand, #f97316)', textDecoration:'none', fontWeight:600 }}>← Back to FoodTaxi</a>
    </div>
  )

  const { business, vans, menuItems } = data
  const allCats = [...new Set(menuItems?.map((i: any) => i.category).filter(Boolean))] as string[]
  const sortedCats = [...CAT_ORDER.filter(c => allCats.includes(c)), ...allCats.filter(c => !CAT_ORDER.includes(c))]
  const byCategory: Record<string, any[]> = {}
  for (const item of menuItems ?? []) {
    const cat = item.category ?? 'Other'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(item)
  }

  const emoji = TYPE_EMOJI[business.business_type] ?? '🍽️'
  const anyLive = vans?.some((v: any) => v.tracking_status === 'live')
  const mapsQuery = encodeURIComponent([business.name, business.city, business.postcode].filter(Boolean).join(' '))
  const phone = business.phone || vans?.[0]?.phone
  const todayIdx = (new Date().getDay() + 6) % 7
  const schedDays = [0,1,2,3,4,5,6].filter(d => schedule.some(s => s.day_of_week === d))

  if (view === 'done') return (
    <div style={{ background:'#080c18', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:'system-ui,sans-serif', padding:24, textAlign:'center' }}>
      <div style={{ fontSize:72, marginBottom:16 }}>✅</div>
      <h1 style={{ fontSize:26, fontWeight:900, margin:'0 0 8px' }}>Order Placed!</h1>
      <div style={{ fontSize:14, color:'#9ca3af', marginBottom:8 }}>Order reference</div>
      <div style={{ fontSize:28, fontWeight:900, color:'var(--brand, #f97316)', marginBottom:24 }}>#{orderNum}</div>
      {pickupStop && (
        <div style={{ background:'color-mix(in srgb, var(--brand, #f97316) 10%, transparent)', border:'1px solid color-mix(in srgb, var(--brand, #f97316) 30%, transparent)', borderRadius:12, padding:'12px 20px', marginBottom:16, textAlign:'center' }}>
          <div style={{ fontSize:13, color:'var(--accent, #fdba74)', fontWeight:700 }}>📍 Pick up at {pickupStop.location_name}{pickupDayOffset > 0 ? ` · ${selectedPickupDay.label} ${selectedPickupDay.dateLabel}` : ''}{pickupTime ? ` · around ${pickupTime}` : ''}</div>
        </div>
      )}
      <p style={{ color:'#9ca3af', fontSize:14, maxWidth:300, lineHeight:1.6, marginBottom:32 }}>
        We've received your order at {business.name}. They'll contact you on {form.phone} when it's ready.
      </p>
      <a href={`/van/${params.slug}`} style={{ padding:'14px 32px', background:'linear-gradient(135deg,var(--brand, #f97316),var(--brand2, #ea580c))', color:'#fff', borderRadius:14, textDecoration:'none', fontWeight:800, fontSize:15 }}>
        ← Back to Menu
      </a>
    </div>
  )

  if (view === 'checkout') return (
    <div style={{ background:'#080c18', minHeight:'100vh', fontFamily:'system-ui,sans-serif', color:'#fff' }}>
      <div style={{ background:'#0d1427', borderBottom:'1px solid #1e2a45', padding:'12px 20px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={() => setView('menu')} style={{ background:'none', border:'none', color:'var(--brand, #f97316)', fontSize:14, fontWeight:600, cursor:'pointer', padding:0 }}>← Back to Menu</button>
      </div>
      <div style={{ padding:'24px 20px', maxWidth:480, margin:'0 auto' }}>
        <h2 style={{ fontSize:22, fontWeight:900, margin:'0 0 20px' }}>Your Order</h2>
        {cartItems.map((item: any) => (
          <div key={item.id} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #1e2a45' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:14 }}>{item.name}</div>
              <div style={{ fontSize:12, color:'#9ca3af' }}>x{cart[item.id]} · £{(item.price * cart[item.id]).toFixed(2)}</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button onClick={() => removeFromCart(item.id)} style={{ width:28, height:28, borderRadius:'50%', border:'1px solid #374151', background:'#1e2a45', color:'#fff', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
              <span style={{ fontSize:14, fontWeight:700 }}>{cart[item.id]}</span>
              <button onClick={() => addToCart(item.id)} style={{ width:28, height:28, borderRadius:'50%', border:'none', background:'var(--brand, #f97316)', color:'#fff', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
            </div>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between', padding:'14px 0', fontSize:18, fontWeight:900, color:'var(--brand, #f97316)', marginBottom:24 }}>
          <span>Total</span><span>£{cartTotal.toFixed(2)}</span>
        </div>

        {/* Pickup day + location + time */}
        {(() => {
          if (!schedule.length) return null
          const dayStops = schedule.filter((s: any) => s.day_of_week === selectedPickupDay.dow).slice().sort((a: any, b: any) => String(a.arrival_time).localeCompare(String(b.arrival_time)))
          const genSlots = (stop: any) => {
            const slots: string[] = []
            const [ah, am] = stop.arrival_time.split(':').map(Number)
            const [dh, dm] = stop.departure_time.split(':').map(Number)
            let cur = ah * 60 + am
            const end = dh * 60 + dm
            while (cur + 30 <= end) {
              const h = Math.floor(cur / 60), m = cur % 60
              const label = `${h > 12 ? h - 12 : h}:${m.toString().padStart(2,'0')}${h >= 12 ? 'pm' : 'am'}`
              slots.push(label)
              cur += 30
            }
            return slots
          }
          return (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:800, color:'var(--brand, #f97316)', marginBottom:10, textTransform:'uppercase', letterSpacing:0.5 }}>🗓️ Which day?</div>
              <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:8, marginBottom:12 }}>
                {pickupDays.map(d => {
                  const hasStops = schedule.some((s: any) => s.day_of_week === d.dow)
                  const sel = pickupDayOffset === d.offset
                  return (
                    <button key={d.offset} disabled={!hasStops}
                      onClick={() => { setPickupDayOffset(d.offset); setPickupStop(null); setPickupTime('') }}
                      style={{ flexShrink:0, padding:'8px 12px', borderRadius:10, cursor: hasStops ? 'pointer' : 'default',
                        border: sel ? '1px solid var(--brand, #f97316)' : '1px solid #1e2a45',
                        background: sel ? 'color-mix(in srgb, var(--brand, #f97316) 20%, transparent)' : '#0d1427',
                        color: !hasStops ? '#374151' : sel ? 'var(--brand, #f97316)' : '#9ca3af',
                        opacity: hasStops ? 1 : 0.5, textAlign:'center' }}>
                      <div style={{ fontSize:12, fontWeight:800 }}>{d.label}</div>
                      <div style={{ fontSize:10 }}>{d.dateLabel}</div>
                    </button>
                  )
                })}
              </div>
              {dayStops.length === 0 && (
                <div style={{ fontSize:13, color:'#6b7280', fontStyle:'italic', marginBottom:12 }}>No stops on this day — pick another day above</div>
              )}
              {dayStops.length > 0 && (
              <div style={{ fontSize:13, fontWeight:800, color:'var(--brand, #f97316)', marginBottom:10, textTransform:'uppercase', letterSpacing:0.5 }}>📍 Where to pick up?</div>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {dayStops.map((stop: any) => {
                  const sel = pickupStop?.id === stop.id
                  const slots = sel ? genSlots(stop) : []
                  return (
                    <div key={stop.id} style={{ border: sel ? '1px solid var(--brand, #f97316)' : '1px solid #1e2a45', borderRadius:12, overflow:'hidden' }}>
                      <button onClick={() => { setPickupStop(sel ? null : stop); setPickupTime('') }} style={{ width:'100%', padding:'12px 14px', background: sel ? 'color-mix(in srgb, var(--brand, #f97316) 12%, transparent)' : '#0d1427', border:'none', color:'#fff', textAlign:'left', cursor:'pointer', display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:20, height:20, borderRadius:'50%', border:`2px solid ${sel ? 'var(--brand, #f97316)' : '#374151'}`, background: sel ? 'var(--brand, #f97316)' : 'transparent', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {sel && <div style={{ width:8, height:8, borderRadius:'50%', background:'#fff' }} />}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:700, fontSize:14 }}>{stop.location_name}</div>
                          <div style={{ fontSize:12, color:'#6b7280' }}>Van here {stop.arrival_time}–{stop.departure_time}{stop.notes ? ` · ${stop.notes}` : ''}</div>
                        </div>
                      </button>
                      {sel && slots.length > 0 && (
                        <div style={{ padding:'10px 14px 12px', background:'color-mix(in srgb, var(--brand, #f97316) 5%, transparent)', borderTop:'1px solid color-mix(in srgb, var(--brand, #f97316) 15%, transparent)' }}>
                          <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', marginBottom:8 }}>ROUGHLY WHAT TIME?</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                            {slots.map(slot => (
                              <button key={slot} onClick={() => setPickupTime(pickupTime === slot ? '' : slot)} style={{ padding:'6px 12px', borderRadius:8, border: pickupTime === slot ? '1px solid var(--brand, #f97316)' : '1px solid #1e2a45', background: pickupTime === slot ? 'color-mix(in srgb, var(--brand, #f97316) 20%, transparent)' : '#0d1427', color: pickupTime === slot ? 'var(--brand, #f97316)' : '#9ca3af', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                                {slot}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'#9ca3af', display:'block', marginBottom:6 }}>Your Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} placeholder="e.g. John Smith" style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:'1px solid #1e2a45', background:'#0d1427', color:'#fff', fontSize:15, outline:'none', boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'#9ca3af', display:'block', marginBottom:6 }}>Phone Number *</label>
            <input value={form.phone} onChange={e => setForm(f => ({...f, phone:e.target.value}))} placeholder="e.g. 07700 900000" type="tel" style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:'1px solid #1e2a45', background:'#0d1427', color:'#fff', fontSize:15, outline:'none', boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'#9ca3af', display:'block', marginBottom:6 }}>Notes (optional)</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))} placeholder="Any special requests?" rows={2} style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:'1px solid #1e2a45', background:'#0d1427', color:'#fff', fontSize:15, outline:'none', boxSizing:'border-box', resize:'vertical' }} />
          </div>
        </div>

        <div style={{ background:'color-mix(in srgb, var(--brand, #f97316) 10%, transparent)', border:'1px solid color-mix(in srgb, var(--brand, #f97316) 20%, transparent)', borderRadius:10, padding:12, fontSize:12, color:'var(--accent, #fdba74)', margin:'16px 0' }}>
          💵 Payment: Cash at van — pay when you collect your order
        </div>

        <button onClick={placeOrder} disabled={placing || !form.name || !form.phone} style={{ width:'100%', padding:'16px', borderRadius:14, border:'none', background: placing ? 'color-mix(in srgb, var(--brand, #f97316) 50%, transparent)' : 'linear-gradient(135deg,var(--brand, #f97316),var(--brand2, #ea580c))', color:'#fff', fontSize:16, fontWeight:800, cursor: placing ? 'wait' : 'pointer' }}>
          {placing ? 'Placing Order…' : `✅ Place Order · £${cartTotal.toFixed(2)}`}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ background:'#080c18', minHeight:'100vh', fontFamily:'system-ui,-apple-system,sans-serif', color:'#fff', paddingBottom: cartCount > 0 ? 100 : 0 }}>
      {/* Header */}
      <div style={{ background:'#0d1427', borderBottom:'1px solid #1e2a45', padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <a href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
          <div style={{ background:'linear-gradient(135deg,var(--brand, #f97316),var(--brand2, #ea580c))', borderRadius:8, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:14, color:'#fff' }}>FT</div>
          <span style={{ fontSize:18, fontWeight:800, color:'#fff' }}>FoodTaxi</span>
        </a>
        <a href="/search" style={{ fontSize:13, color:'var(--brand, #f97316)', textDecoration:'none', fontWeight:600 }}>← Search</a>
      </div>

      {/* Hero */}
      <div style={{ padding:'36px 20px 20px', textAlign:'center' }}>
        <div style={{ fontSize:64, marginBottom:12, lineHeight:1 }}>{emoji}</div>
        <h1 style={{ fontSize:28, fontWeight:900, margin:'0 0 10px', letterSpacing:-0.5 }}>{business.name}</h1>
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, background: anyLive ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.15)', border:`1px solid ${anyLive ? 'rgba(16,185,129,0.4)' : 'rgba(107,114,128,0.3)'}`, borderRadius:20, padding:'4px 12px', fontSize:12, fontWeight:700, color: anyLive ? '#6ee7b7' : '#9ca3af', marginBottom:10 }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background: anyLive ? '#10b981' : '#4b5563', boxShadow: anyLive ? '0 0 6px #10b981' : 'none' }} />
          {anyLive ? 'Van is Live Now' : 'Currently Offline'}
        </div>
        {(business.city || business.postcode) && (
          <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>📍 {[business.city, business.postcode].filter(Boolean).join(', ')}</div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ padding:'0 20px 20px', display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
        {phone && (
          <a href={`tel:${phone}`} style={{ padding:'12px 20px', background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)', color:'#6ee7b7', borderRadius:12, textDecoration:'none', fontWeight:700, fontSize:14 }}>
            📞 Call
          </a>
        )}
        <a href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noopener noreferrer" style={{ padding:'12px 20px', background:'color-mix(in srgb, var(--brand, #f97316) 15%, transparent)', border:'1px solid color-mix(in srgb, var(--brand, #f97316) 30%, transparent)', color:'var(--accent, #fdba74)', borderRadius:12, textDecoration:'none', fontWeight:700, fontSize:14 }}>
          🗺 Directions
        </a>
      </div>

      {/* Live Tracking — always shown */}
      <div style={{ padding:'0 16px 12px' }}>
        <a href="https://liveshare.ramtracking.com/?token=cb236545-b5ef-4bbd-b8a3-ca7dc6b08cbe" target="_blank" rel="noopener noreferrer" style={{ display:'flex', alignItems:'center', gap:10, background: anyLive ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)', border:`1px solid ${anyLive ? 'rgba(16,185,129,0.3)' : '#1e2a45'}`, borderRadius:12, padding:'12px 16px', textDecoration:'none' }}>
          <div style={{ width:10, height:10, borderRadius:'50%', background: anyLive ? '#10b981' : '#4b5563', boxShadow: anyLive ? '0 0 8px #10b981' : 'none', flexShrink:0 }} />
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:14, color: anyLive ? '#6ee7b7' : '#9ca3af' }}>{anyLive ? 'Track Van Live' : '🗺 Van Location Tracker'}</div>
            <div style={{ fontSize:12, color: anyLive ? '#4ade80' : '#4b5563', opacity:0.8 }}>{anyLive ? 'Tap to see live location on map' : 'Live tracking available when van is out'}</div>
          </div>
          <div style={{ color: anyLive ? '#6ee7b7' : '#374151', fontSize:18 }}>→</div>
        </a>
      </div>

      {/* Schedule — calendar day tabs, one day's stops at a time */}
      <div style={{ padding:'0 16px 20px' }}>
        <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', margin:'0 0 12px' }}>📍 Where We'll Be</h2>
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:10 }}>
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date()
            d.setDate(d.getDate() + i)
            const dow = (d.getDay() + 6) % 7
            const hasStops = schedule.some(s => s.day_of_week === dow)
            const sel = schedViewDay === i
            const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'short' })
            const dateLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            return (
              <button key={i} onClick={() => setSchedViewDay(i)}
                style={{ flexShrink:0, padding:'8px 12px', borderRadius:10, cursor:'pointer', textAlign:'center',
                  border: sel ? '1px solid var(--brand, #f97316)' : '1px solid #1e2a45',
                  background: sel ? 'color-mix(in srgb, var(--brand, #f97316) 15%, transparent)' : '#0d1427',
                  color: sel ? 'var(--brand, #f97316)' : hasStops ? '#e5e7eb' : '#374151' }}>
                <div style={{ fontSize:12, fontWeight:800 }}>{label}</div>
                <div style={{ fontSize:10, color: sel ? 'var(--accent, #fdba74)' : '#6b7280' }}>{dateLabel}</div>
              </button>
            )
          })}
        </div>
        {(() => {
          const d = new Date()
          d.setDate(d.getDate() + schedViewDay)
          const dow = (d.getDay() + 6) % 7
          const stops = schedule.filter(s => s.day_of_week === dow).slice().sort((a, b) => String(a.arrival_time).localeCompare(String(b.arrival_time)))
          return (
            <div style={{ background: schedViewDay === 0 ? 'color-mix(in srgb, var(--brand, #f97316) 8%, transparent)' : '#0d1427', border: schedViewDay === 0 ? '1px solid color-mix(in srgb, var(--brand, #f97316) 35%, transparent)' : '1px solid #1e2a45', borderRadius:12, padding:'12px 14px' }}>
              {stops.length === 0 && (
                <div style={{ fontSize:13, color:'#6b7280', fontStyle:'italic' }}>Not out on this day 🛌</div>
              )}
              {stops.map((stop, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom: i < stops.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ fontSize:12, color:'var(--brand, #f97316)', fontWeight:800, minWidth:42 }}>{stop.arrival_time}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'#e5e7eb' }}>{stop.location_name}</div>
                    <div style={{ fontSize:11, color:'#6b7280' }}>until {stop.departure_time}{stop.notes ? ` · ${stop.notes}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* Order Online banner */}
      {menuItems?.length > 0 && (
        <div style={{ padding:'0 16px 16px' }}>
          <button onClick={() => { if (cartCount > 0) setView('checkout'); else document.getElementById('menu-top')?.scrollIntoView({ behavior:'smooth' }) }} style={{ width:'100%', padding:'16px', borderRadius:14, border:'none', background:'linear-gradient(135deg,var(--brand, #f97316),var(--brand2, #ea580c))', color:'#fff', fontSize:16, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
            🛒 {cartCount > 0 ? `Order Online · £${cartTotal.toFixed(2)} (${cartCount} items)` : 'Order Online — tap + to add items'}
          </button>
        </div>
      )}

      {/* Menu */}
      {menuItems?.length > 0 ? (
        <div style={{ padding:'0 16px 20px' }}>
          <h2 id="menu-top" style={{ fontSize:20, fontWeight:800, color:'#fff', margin:'0 0 16px', padding:'0 4px' }}>Our Menu</h2>
          {sortedCats.map(cat => (
            <div key={cat} style={{ marginBottom:24 }}>
              <div style={{ fontSize:13, fontWeight:800, color:'var(--brand, #f97316)', letterSpacing:1, textTransform:'uppercase', marginBottom:10, padding:'0 4px' }}>{cat}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                {byCategory[cat]?.map((item: any) => (
                  <div key={item.id} style={{ background:'#0d1427', borderRadius:10, padding:'12px 14px', display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:'#fff' }}>{item.name}</div>
                      {item.description && <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{item.description}</div>}
                      <div style={{ fontWeight:800, fontSize:15, color:'var(--brand, #f97316)', marginTop:4 }}>£{Number(item.price).toFixed(2)}</div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                      {cart[item.id] ? (
                        <>
                          <button onClick={() => removeFromCart(item.id)} style={{ width:32, height:32, borderRadius:'50%', border:'1px solid #374151', background:'#1e2a45', color:'#fff', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                          <span style={{ fontSize:14, fontWeight:700, minWidth:20, textAlign:'center' }}>{cart[item.id]}</span>
                        </>
                      ) : null}
                      <button onClick={() => addToCart(item.id)} style={{ width:32, height:32, borderRadius:'50%', border:'none', background:'var(--brand, #f97316)', color:'#fff', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding:'20px', textAlign:'center', color:'#6b7280' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🍽️</div>
          <div style={{ fontSize:15, fontWeight:600 }}>Menu coming soon</div>
        </div>
      )}

      {/* Sticky cart bar */}
      {cartCount > 0 && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'16px 20px', background:'#0d1427', borderTop:'1px solid #1e2a45', zIndex:100 }}>
          <button onClick={() => setView('checkout')} style={{ width:'100%', padding:'16px', borderRadius:14, border:'none', background:'linear-gradient(135deg,var(--brand, #f97316),var(--brand2, #ea580c))', color:'#fff', fontSize:16, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ background:'rgba(255,255,255,0.2)', borderRadius:8, padding:'2px 10px', fontSize:14 }}>{cartCount}</span>
            <span>Order Online</span>
            <span>£{cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding:'20px', textAlign:'center', borderTop:'1px solid #1e2a45' }}>
        <a href="/" style={{ display:'inline-block', padding:'10px 24px', background:'linear-gradient(135deg,var(--brand, #f97316),var(--brand2, #ea580c))', color:'#fff', borderRadius:12, textDecoration:'none', fontWeight:700, fontSize:13 }}>
          Powered by FoodTaxi
        </a>
      </div>
    </div>
  )
}
