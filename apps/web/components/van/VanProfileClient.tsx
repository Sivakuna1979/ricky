// @ts-nocheck
'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { LiveVanTracker } from '@/components/map/LiveVanTracker'
import { LiveStatusBadge } from '@/components/van/LiveStatusBadge'
import { sortCategories } from '@/lib/categoryOrder'
import { pushSupported, subscribeToVanArrival } from '@/lib/push/client'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const TYPE_EMOJI: Record<string, string> = {
  fish_and_chips:'🐟', burger:'🍔', pizza:'🍕', coffee:'☕',
  ice_cream:'🍦', kebab:'🥙', street_food:'🌮', catering_trailer:'🚐',
  bakery:'🥖', fast_food:'🍟', other:'🍽️',
}

function track(eventType: string, extra: any = {}) {
  try {
    fetch('/api/analytics/event', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType, ...extra }), keepalive: true,
    }).catch(() => {})
  } catch {}
}

export default function VanProfileClient({ slug }: { slug: string }) {
  const searchParams = useSearchParams()
  const reorderOrderId = searchParams?.get('reorder') ?? null
  const qrStopId = searchParams?.get('stop') ?? null

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
  const [search, setSearch]       = useState('')            // J18 — deterministic menu search, no AI
  const [maxPrice, setMaxPrice]   = useState<number | null>(null) // J53/J54 — plain filtering, not an AI call
  const [me, setMe]               = useState<any>(null)     // signed-in customer, or null for guest
  const [favVanIds, setFavVanIds] = useState<Set<string>>(new Set())
  const [favItemIds, setFavItemIds] = useState<Set<string>>(new Set())
  const [favStopIds, setFavStopIds] = useState<Set<string>>(new Set())
  const [reorderDiff, setReorderDiff] = useState<any>(null)
  const [reorderApplied, setReorderApplied] = useState(false)
  const [canShare, setCanShare] = useState(false)
  const [arrivalPushState, setArrivalPushState] = useState<'idle'|'working'|'on'|'unsupported'>('idle')
  const cartStartedRef = useRef(false)

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && !!navigator.share)
    if (!pushSupported()) setArrivalPushState('unsupported')
  }, [])

  const enableArrivalPush = async () => {
    if (!data?.business?.id || !data?.vans?.[0]?.id) return
    setArrivalPushState('working')
    const res = await subscribeToVanArrival(data.business.id, data.vans[0].id)
    setArrivalPushState(res.ok ? 'on' : 'idle')
  }

  // Next 7 days: label + weekday index (0=Mon..6=Sun) + date string
  const pickupDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const dow = (d.getDay() + 6) % 7
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'short' })
    const dateLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    const date = d.toISOString().slice(0, 10)
    return { offset: i, dow, label, dateLabel, date }
  })
  const selectedPickupDay = pickupDays[pickupDayOffset]
  const [placing, setPlacing]     = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [orderNum, setOrderNum]   = useState('')
  const [placedOrderId, setPlacedOrderId] = useState('')

  useEffect(() => {
    fetch(`/api/van-profile/${slug}`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        const sched = Array.isArray(d?.schedule) ? d.schedule : []
        setSchedule(sched)
        if (d?.business) track('menu_view', { business_id: d.business.id, van_id: d.vans?.[0]?.id })
        // Defaulting to "Today" is a dead end if the van isn't out today —
        // jump to the nearest upcoming day that actually has a stop instead
        // of leaving the customer stuck on an empty "no stops" screen.
        if (sched.length) {
          const todayHasStops = sched.some((s: any) => s.day_of_week === ((new Date().getDay() + 6) % 7))
          if (!todayHasStops) {
            // pickupDays only covers offsets 0-6 (a 7-day window) — must not
            // pick an offset outside that range or selectedPickupDay becomes
            // undefined and crashes the page.
            for (let i = 1; i <= 6; i++) {
              const dow = ((new Date().getDay() + 6 + i) % 7)
              if (sched.some((s: any) => s.day_of_week === dow)) { setPickupDayOffset(i); break }
            }
          }
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [slug])

  // J7/J13/J14 — who's signed in (if anyone) and their favourites. A 401
  // just means "guest" — favourites/reorder simply don't show, ordering
  // itself is completely unaffected.
  useEffect(() => {
    fetch('/api/customer/me').then(r => r.ok ? r.json() : null).then(d => { if (d) setMe(d) }).catch(() => {})
    fetch('/api/customer/favourites/vans').then(r => r.ok ? r.json() : null).then(d => { if (d) setFavVanIds(new Set(d.favourites.map((f: any) => f.van_id))) }).catch(() => {})
    fetch('/api/customer/favourites/items').then(r => r.ok ? r.json() : null).then(d => { if (d) setFavItemIds(new Set(d.favourites.map((f: any) => f.menu_item_id))) }).catch(() => {})
    fetch('/api/customer/favourites/stops').then(r => r.ok ? r.json() : null).then(d => { if (d) setFavStopIds(new Set(d.favourites.map((f: any) => f.stop_id))) }).catch(() => {})
  }, [])

  // J12 — reorder: fetch the diff, but only ever pre-fill the cart from
  // items already present in this page's own live menu fetch (`data`),
  // never from the reorder endpoint's own price. Shows removed/price-
  // changed items in a banner before the customer confirms anything.
  useEffect(() => {
    if (!reorderOrderId || !data?.menuItems || reorderApplied) return
    fetch(`/api/customer/orders/${reorderOrderId}/reorder`).then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return
      setReorderDiff(d)
      const liveIds = new Set(data.menuItems.map((i: any) => i.id))
      const next: Record<string, number> = {}
      for (const item of d.items ?? []) {
        if (item.menu_item_id && liveIds.has(item.menu_item_id)) next[item.menu_item_id] = (next[item.menu_item_id] ?? 0) + item.quantity
      }
      if (Object.keys(next).length) { setCart(next); track('reorder_used') }
      setReorderApplied(true)
    }).catch(() => setReorderApplied(true))
  }, [reorderOrderId, data, reorderApplied])

  // J28 — a stop-context QR pre-selects that stop, but only if it's
  // genuinely on this van's live schedule for an upcoming day; the actual
  // order still goes through the normal server-side stop verification
  // (app/api/orders/guest) regardless.
  useEffect(() => {
    if (!qrStopId || !schedule.length) return
    for (const d of pickupDays) {
      const stop = schedule.find((s: any) => s.id === qrStopId && s.day_of_week === d.dow)
      if (stop) { setPickupDayOffset(d.offset); setPickupStop(stop); break }
    }
  }, [qrStopId, schedule]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFavouriteVan = async (vanId: string) => {
    if (!me) { window.location.href = `/login?next=${encodeURIComponent(`/van/${slug}`)}`; return }
    const isFav = favVanIds.has(vanId)
    setFavVanIds(s => { const n = new Set(s); isFav ? n.delete(vanId) : n.add(vanId); return n })
    if (isFav) await fetch(`/api/customer/favourites/vans?van_id=${vanId}`, { method: 'DELETE' }).catch(() => {})
    else await fetch('/api/customer/favourites/vans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ van_id: vanId }) }).catch(() => {})
  }
  const toggleFavouriteItem = async (itemId: string) => {
    if (!me) { window.location.href = `/login?next=${encodeURIComponent(`/van/${slug}`)}`; return }
    const isFav = favItemIds.has(itemId)
    setFavItemIds(s => { const n = new Set(s); isFav ? n.delete(itemId) : n.add(itemId); return n })
    if (isFav) await fetch(`/api/customer/favourites/items?menu_item_id=${itemId}`, { method: 'DELETE' }).catch(() => {})
    else await fetch('/api/customer/favourites/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ menu_item_id: itemId }) }).catch(() => {})
  }
  const toggleFavouriteStop = async (stopId: string) => {
    if (!me) { window.location.href = `/login?next=${encodeURIComponent(`/van/${slug}`)}`; return }
    const isFav = favStopIds.has(stopId)
    setFavStopIds(s => { const n = new Set(s); isFav ? n.delete(stopId) : n.add(stopId); return n })
    if (isFav) await fetch(`/api/customer/favourites/stops?stop_id=${stopId}`, { method: 'DELETE' }).catch(() => {})
    else await fetch('/api/customer/favourites/stops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stop_id: stopId }) }).catch(() => {})
  }

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

  const addToCart = (id: string) => {
    if (!cartStartedRef.current) { cartStartedRef.current = true; track('cart_start', { business_id: data?.business?.id, van_id: data?.vans?.[0]?.id }) }
    setCart(c => ({ ...c, [id]: (c[id] ?? 0) + 1 }))
  }
  const removeFromCart = (id: string) => setCart(c => {
    const next = { ...c }
    if ((next[id] ?? 0) <= 1) delete next[id]
    else next[id]--
    return next
  })

  const cartItems = data?.menuItems?.filter((i: any) => cart[i.id]) ?? []
  const cartTotal = cartItems.reduce((s: number, i: any) => s + i.price * (cart[i.id] ?? 0), 0)
  const cartCount = Object.values(cart).reduce((s: number, n) => s + (n as number), 0)

  // J18 — deterministic client-side search across name/description/category.
  const searchedItems = useMemo(() => {
    let items = data?.menuItems ?? []
    const q = search.trim().toLowerCase()
    if (q) {
      items = items.filter((i: any) =>
        i.name?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q)
      )
    }
    if (maxPrice != null) items = items.filter((i: any) => Number(i.price) <= maxPrice)
    return items
  }, [data?.menuItems, search, maxPrice])

  // Order via WhatsApp: log the order in the dashboard, then open WhatsApp
  // with the full order pre-written so the customer just taps send.
  const orderViaWhatsApp = async () => {
    const waNum = (data?.business?.phone || data?.vans?.[0]?.phone || '').replace(/[^\d]/g, '').replace(/^0/, '44')
    if (!waNum) return
    const dayBit = pickupStop?.id === 'live' ? '' : (pickupDayOffset === 0 ? 'today' : `${selectedPickupDay.label} ${selectedPickupDay.dateLabel}`)
    const lines = [
      `Hi ${data.business.name}! I'd like to order:`,
      ...cartItems.map((i: any) => `• ${cart[i.id]}x ${i.name} — £${(i.price * cart[i.id]).toFixed(2)}`),
      `Total: £${cartTotal.toFixed(2)}`,
      pickupStop ? `Pickup: ${pickupStop.location_name} ${dayBit}${pickupTime ? ` around ${pickupTime}` : ''}` : '',
      form.name ? `Name: ${form.name}` : '',
      form.notes ? `Notes: ${form.notes}` : '',
    ].filter(Boolean)
    // Log it in the dashboard too (best effort — WhatsApp opens regardless)
    fetch('/api/orders/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        van_id: data.vans?.[0]?.id,
        business_id: data.business?.id,
        customer_name: form.name || 'WhatsApp customer',
        customer_phone: form.phone || 'via WhatsApp',
        notes: `[WhatsApp order] ${form.notes ?? ''}`.trim(),
        pickup_location: pickupStop?.location_name ?? null,
        pickup_stop_id: pickupStop && pickupStop.id !== 'live' ? pickupStop.id : null,
        service_date: pickupStop?.id === 'live' ? undefined : selectedPickupDay.date,
        pickup_time: pickupStop?.id === 'live' ? pickupTime : (pickupTime ? `${pickupDayOffset === 0 ? '' : `${selectedPickupDay.label} ${selectedPickupDay.dateLabel} `}${pickupTime}` : (pickupDayOffset === 0 ? null : `${selectedPickupDay.label} ${selectedPickupDay.dateLabel}`)),
        items: cartItems.map((i: any) => ({ menu_item_id: i.id, name: i.name, price: i.price, quantity: cart[i.id], item_total: i.price * cart[i.id] })),
        subtotal: cartTotal,
        total: cartTotal,
        payment_method: 'cash_at_van',
      }),
    }).catch(() => {})
    window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }

  // Computed early (via optional chaining on `data` directly, not the
  // `vans` destructured below) because it's needed above the loading/
  // not-found guards — referencing a `const` declared further down in the
  // same component before its declaration throws immediately on every load.
  const anyLive = data?.vans?.some((v: any) => v.tracking_status === 'live')

  // What the customer still needs to fill in — pickup is only required when
  // there's actually something to pick: a scheduled stop, or (for a van
  // that's out unscheduled, e.g. an ad-hoc pitch) currently live on the map.
  const hasStops = schedule.length > 0
  const isLivePickup = pickupStop?.id === 'live'
  const pickupRequired = hasStops || anyLive
  const missingBits = [
    pickupRequired && !pickupStop ? '📍 pickup spot' : null,
    pickupRequired && pickupStop && !isLivePickup && !pickupTime ? '⏰ pickup time' : null,
    !form.name.trim() ? '👤 your name' : null,
    !form.phone.trim() ? '📞 phone number' : null,
  ].filter(Boolean)

  const goToCheckout = () => {
    setView('checkout')
    track('checkout_start', { business_id: data?.business?.id, van_id: data?.vans?.[0]?.id })
  }

  const placeOrder = async () => {
    if (missingBits.length) {
      setAttempted(true)
      document.getElementById(pickupRequired && !pickupStop ? 'pickup-section' : 'contact-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setPlacing(true)
    const pickupDayLabel = isLivePickup || pickupDayOffset === 0 ? '' : ` on ${selectedPickupDay.label} ${selectedPickupDay.dateLabel}`
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
        pickup_stop_id: pickupStop && !isLivePickup ? pickupStop.id : null,
        service_date: isLivePickup ? undefined : selectedPickupDay.date,
        pickup_time: isLivePickup ? pickupTime : (pickupTime ? `${pickupDayOffset === 0 ? '' : `${selectedPickupDay.label} ${selectedPickupDay.dateLabel} `}${pickupTime}` : (pickupDayOffset === 0 ? null : `${selectedPickupDay.label} ${selectedPickupDay.dateLabel}`)),
        items: cartItems.map((i: any) => ({ menu_item_id: i.id, name: i.name, price: i.price, quantity: cart[i.id], item_total: i.price * cart[i.id] })),
        subtotal: cartTotal,
        total: cartTotal,
        payment_method: 'cash_at_van',
      }),
    })
    const json = await res.json()
    setPlacing(false)
    if (res.ok) {
      setOrderNum(json.order_number ?? json.id?.slice(0,8).toUpperCase() ?? 'OK')
      setPlacedOrderId(json.id ?? '')
      setView('done')
      track('order_completed', { business_id: data?.business?.id, van_id: data?.vans?.[0]?.id })
    } else if (res.status === 409 && json.correction) {
      // J20 — the server found a stale price/availability mismatch. Apply
      // the correction and show it clearly rather than silently retrying.
      setCart(c => {
        const next = { ...c }
        for (const bad of json.correction) {
          if (bad.reason === 'unavailable') delete next[bad.menu_item_id]
        }
        return next
      })
      alert(json.error ?? 'Some items changed — please review your order and try again.')
    } else {
      alert(json.error ?? 'Failed to place order')
    }
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
  const allCats = [...new Set(searchedItems?.map((i: any) => i.category).filter(Boolean))] as string[]
  const sortedCats = sortCategories(allCats, vans?.[0]?.category_order)
  const byCategory: Record<string, any[]> = {}
  for (const item of searchedItems ?? []) {
    const cat = item.category ?? 'Other'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(item)
  }

  const emoji = TYPE_EMOJI[business.business_type] ?? '🍽️'
  const mapsQuery = encodeURIComponent([business.name, business.city, business.postcode].filter(Boolean).join(' '))
  const phone = business.phone || vans?.[0]?.phone
  // WhatsApp needs international digits: 07961... -> 447961...
  const waNumber = phone ? String(phone).replace(/[^\d]/g, '').replace(/^0/, '44') : ''
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
          <div style={{ fontSize:13, color:'var(--accent, #fdba74)', fontWeight:700 }}>📍 Pick up at {pickupStop.location_name}{pickupStop.id !== 'live' && pickupDayOffset > 0 ? ` · ${selectedPickupDay.label} ${selectedPickupDay.dateLabel}` : ''}{pickupTime ? ` · ${pickupStop.id === 'live' ? pickupTime : `around ${pickupTime}`}` : ''}</div>
        </div>
      )}

      {placedOrderId && (
        <a href={`/order/${placedOrderId}`} style={{ width:'100%', maxWidth:340, display:'block', padding:'14px 20px', marginBottom:20, borderRadius:14, background:'#0d1427', border:'1px solid #1e2a45', color:'#fff', textDecoration:'none', textAlign:'center' }}>
          <div style={{ fontSize:14, fontWeight:800 }}>🚗 Check in when you're on your way</div>
          <div style={{ fontSize:12, color:'#9ca3af', marginTop:3 }}>Orders take just 5-7 minutes — save this link, tap it as you're leaving</div>
        </a>
      )}

      {/* Track the van live while waiting for the order */}
      <div style={{ width:'100%', maxWidth:420, marginBottom:20, textAlign:'left' }}>
        <LiveVanTracker vanId={data?.vans?.[0]?.id} vanName={data?.vans?.[0]?.name ?? business.name} logo={brand?.logo} height="240px" />
      </div>
      <p style={{ color:'#9ca3af', fontSize:14, maxWidth:300, lineHeight:1.6, marginBottom:32 }}>
        We've received your order at {business.name}. They'll contact you on {form.phone} when it's ready.
      </p>
      <a href={`/van/${slug}`} style={{ padding:'14px 32px', background:'linear-gradient(135deg,var(--brand, #f97316),var(--brand2, #ea580c))', color:'#fff', borderRadius:14, textDecoration:'none', fontWeight:800, fontSize:15 }}>
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

        {reorderDiff && (reorderDiff.items ?? []).some((i: any) => i.removed || i.price_changed) && (
          <div style={{ background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.35)', borderRadius:12, padding:'12px 14px', marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#fbbf24', marginBottom:6 }}>⚠️ Some things changed since your last order</div>
            {reorderDiff.items.filter((i: any) => i.removed).map((i: any) => (
              <div key={i.menu_item_id} style={{ fontSize:12, color:'#fca5a5' }}>• {i.name} is no longer available — removed from your order</div>
            ))}
            {reorderDiff.items.filter((i: any) => !i.removed && i.price_changed).map((i: any) => (
              <div key={i.menu_item_id} style={{ fontSize:12, color:'#fcd34d' }}>• {i.name} is now £{Number(i.current_price).toFixed(2)} (was £{Number(i.original_price).toFixed(2)})</div>
            ))}
          </div>
        )}

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

        {/* Pickup: live-now option and/or scheduled day + location + time */}
        {(() => {
          if (!schedule.length && !anyLive) return null
          const pickupMissing = attempted && (!pickupStop || (!isLivePickup && !pickupTime))
          const dayStops = schedule.filter((s: any) => s.day_of_week === selectedPickupDay.dow).slice().sort((a: any, b: any) => String(a.arrival_time).localeCompare(String(b.arrival_time)))
          const genSlots = (stop: any) => {
            // 10-minute slots across the stop's window — always at least the
            // arrival time, so short stops (15-20 min) still offer choices.
            const slots: string[] = []
            const [ah, am] = stop.arrival_time.split(':').map(Number)
            const [dh, dm] = stop.departure_time.split(':').map(Number)
            let cur = ah * 60 + am
            const end = dh * 60 + dm
            while (cur <= end && slots.length < 12) {
              const h = Math.floor(cur / 60), m = cur % 60
              const label = `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${m.toString().padStart(2,'0')}${h >= 12 ? 'pm' : 'am'}`
              slots.push(label)
              cur += 10
            }
            return slots
          }
          return (
            <div id="pickup-section" style={{ marginBottom:20, borderRadius:14, padding: pickupMissing ? '12px' : 0, border: pickupMissing ? '2px solid #ef4444' : 'none', background: pickupMissing ? 'rgba(239,68,68,0.06)' : 'transparent' }}>
              {pickupMissing && (
                <div style={{ fontSize:13, fontWeight:800, color:'#f87171', marginBottom:10 }}>
                  ⚠️ {!pickupStop ? 'Please choose where you\'ll collect your order' : 'Please pick a rough collection time'}
                </div>
              )}

              {anyLive && (
                <button onClick={() => { setPickupStop(isLivePickup ? null : { id:'live', location_name:"Wherever we're parked right now — check the map above" }); setPickupTime(isLivePickup ? '' : 'ASAP') }}
                  style={{ width:'100%', textAlign:'left', padding:'14px 16px', borderRadius:12, marginBottom: schedule.length ? 12 : 0,
                    border: isLivePickup ? '1px solid #10b981' : '1px solid #1e2a45',
                    background: isLivePickup ? 'rgba(16,185,129,0.12)' : '#0d1427', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ width:9, height:9, borderRadius:'50%', background:'#10b981', boxShadow:'0 0 6px #10b981', flexShrink:0 }} />
                  <div>
                    <div style={{ fontWeight:800, fontSize:14, color: isLivePickup ? '#6ee7b7' : '#fff' }}>We're live right now — order for pickup ASAP</div>
                    <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>{isLivePickup ? 'Selected — see the map above for our exact spot' : 'Skip the schedule, collect wherever we\'re parked'}</div>
                  </div>
                </button>
              )}

              {schedule.length > 0 && !isLivePickup && (
                <>
                  {anyLive && <div style={{ textAlign:'center', fontSize:12, color:'#6b7280', margin:'12px 0' }}>— or pick a scheduled stop instead —</div>}
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
                </>
              )}
            </div>
          )
        })()}

        <div id="contact-section" style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color: attempted && !form.name.trim() ? '#f87171' : '#9ca3af', display:'block', marginBottom:6 }}>Your Name * {attempted && !form.name.trim() ? '— required' : ''}</label>
            <input value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} placeholder="e.g. John Smith" style={{ width:'100%', padding:'12px 14px', borderRadius:10, border: attempted && !form.name.trim() ? '2px solid #ef4444' : '1px solid #1e2a45', background:'#0d1427', color:'#fff', fontSize:15, outline:'none', boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color: attempted && !form.phone.trim() ? '#f87171' : '#9ca3af', display:'block', marginBottom:6 }}>Phone Number * {attempted && !form.phone.trim() ? '— required' : ''}</label>
            <input value={form.phone} onChange={e => setForm(f => ({...f, phone:e.target.value}))} placeholder="e.g. 07700 900000" type="tel" style={{ width:'100%', padding:'12px 14px', borderRadius:10, border: attempted && !form.phone.trim() ? '2px solid #ef4444' : '1px solid #1e2a45', background:'#0d1427', color:'#fff', fontSize:15, outline:'none', boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'#9ca3af', display:'block', marginBottom:6 }}>Notes (optional)</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))} placeholder="Any special requests?" rows={2} style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:'1px solid #1e2a45', background:'#0d1427', color:'#fff', fontSize:15, outline:'none', boxSizing:'border-box', resize:'vertical' }} />
          </div>
        </div>

        <div style={{ background:'color-mix(in srgb, var(--brand, #f97316) 10%, transparent)', border:'1px solid color-mix(in srgb, var(--brand, #f97316) 20%, transparent)', borderRadius:10, padding:12, fontSize:12, color:'var(--accent, #fdba74)', margin:'16px 0' }}>
          💵 Payment: Cash at van — pay when you collect your order
        </div>

        {(data?.business?.phone || data?.vans?.[0]?.phone) && (
          <button onClick={orderViaWhatsApp} style={{ width:'100%', padding:'14px', borderRadius:14, border:'1px solid rgba(37,211,102,0.4)', background:'rgba(37,211,102,0.12)', color:'#4ade80', fontSize:15, fontWeight:800, cursor:'pointer', marginBottom:10 }}>
            💬 Order via WhatsApp · £{cartTotal.toFixed(2)}
          </button>
        )}
        {attempted && missingBits.length > 0 && (
          <div style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.4)', borderRadius:12, padding:'12px 14px', marginBottom:10 }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#f87171' }}>Almost there! Please complete:</div>
            <div style={{ fontSize:13, color:'#fca5a5', marginTop:4 }}>{missingBits.join(' · ')}</div>
          </div>
        )}
        <button onClick={placeOrder} disabled={placing} style={{ width:'100%', padding:'16px', borderRadius:14, border:'none', background: placing ? 'color-mix(in srgb, var(--brand, #f97316) 50%, transparent)' : 'linear-gradient(135deg,var(--brand, #f97316),var(--brand2, #ea580c))', color:'#fff', fontSize:16, fontWeight:800, cursor: placing ? 'wait' : 'pointer', opacity: attempted && missingBits.length ? 0.85 : 1 }}>
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
      <div style={{ padding:'36px 20px 20px', textAlign:'center', position:'relative' }}>
        <button onClick={() => toggleFavouriteVan(vans?.[0]?.id)} aria-label={favVanIds.has(vans?.[0]?.id) ? 'Remove from favourites' : 'Add to favourites'}
          style={{ position:'absolute', top:12, right:16, background:'rgba(255,255,255,0.08)', border:'none', borderRadius:'50%', width:40, height:40, fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {favVanIds.has(vans?.[0]?.id) ? '❤️' : '🤍'}
        </button>
        {brand?.logo ? (
          <img src={brand.logo} alt={business.name} style={{ width:96, height:96, borderRadius:20, objectFit:'cover', marginBottom:12, border:'2px solid rgba(255,255,255,0.15)', boxShadow:'0 4px 16px rgba(0,0,0,0.4)' }} />
        ) : (
          <div style={{ fontSize:64, marginBottom:12, lineHeight:1 }}>{emoji}</div>
        )}
        <h1 style={{ fontSize:28, fontWeight:900, margin:'0 0 10px', letterSpacing:-0.5 }}>{business.name}</h1>
        <LiveStatusBadge liveStatus={data?.liveStatus} />
        {data?.liveStatus?.tradingStatus !== 'LIVE_NOW' && arrivalPushState !== 'unsupported' && (
          <div style={{ marginTop: 10 }}>
            {arrivalPushState === 'on' ? (
              <span style={{ fontSize: 12, color: '#6ee7b7' }}>🔔 We'll notify you when {business.name} goes live</span>
            ) : (
              <button onClick={enableArrivalPush} disabled={arrivalPushState === 'working'} style={{ background: 'none', border: '1px solid rgba(255,255,255,.15)', color: 'rgba(255,255,255,.6)', borderRadius: 10, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                🔔 {arrivalPushState === 'working' ? 'Enabling…' : 'Notify me when live'}
              </button>
            )}
          </div>
        )}
        {(business.city || business.postcode) && (
          <div style={{ fontSize:13, color:'#6b7280', marginTop:10 }}>📍 {[business.city, business.postcode].filter(Boolean).join(', ')}</div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ padding:'0 20px 20px', display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
        {phone && (
          <a href={`tel:${phone}`} style={{ padding:'12px 20px', background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)', color:'#6ee7b7', borderRadius:12, textDecoration:'none', fontWeight:700, fontSize:14 }}>
            📞 Call
          </a>
        )}
        {waNumber && (
          <a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Hi ${business.name}! I'd like to place an order.`)}`} target="_blank" rel="noopener noreferrer"
            style={{ padding:'12px 20px', background:'rgba(37,211,102,0.15)', border:'1px solid rgba(37,211,102,0.35)', color:'#4ade80', borderRadius:12, textDecoration:'none', fontWeight:700, fontSize:14 }}>
            💬 WhatsApp
          </a>
        )}
        <a href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noopener noreferrer" style={{ padding:'12px 20px', background:'color-mix(in srgb, var(--brand, #f97316) 15%, transparent)', border:'1px solid color-mix(in srgb, var(--brand, #f97316) 30%, transparent)', color:'var(--accent, #fdba74)', borderRadius:12, textDecoration:'none', fontWeight:700, fontSize:14 }}>
          🗺 Directions
        </a>
        {canShare && (
          <button onClick={() => navigator.share?.({ title: business.name, url: window.location.href }).catch(() => {})}
            style={{ padding:'12px 20px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.15)', color:'#e5e7eb', borderRadius:12, fontWeight:700, fontSize:14, cursor:'pointer' }}>
            ↗ Share
          </button>
        )}
      </div>

      {/* Live Tracking — our own Uber-style map */}
      <div style={{ padding:'0 16px 12px' }}>
        <LiveVanTracker vanId={vans?.[0]?.id} vanName={vans?.[0]?.name ?? business.name} logo={brand?.logo} height="280px" />
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
              {stops.length === 0 && schedViewDay === 0 && anyLive && (
                <button onClick={() => document.getElementById('menu-top')?.scrollIntoView({ behavior:'smooth' })}
                  style={{ width:'100%', textAlign:'left', background:'none', border:'none', padding:0, cursor:'pointer', fontSize:13, color:'#6ee7b7', fontWeight:700 }}>
                  🔴 Not a scheduled stop today, but we're live right now — tap here to order, pickup ASAP!
                </button>
              )}
              {stops.length === 0 && !(schedViewDay === 0 && anyLive) && (
                <div style={{ fontSize:13, color:'#6b7280', fontStyle:'italic' }}>Not out on this day 🛌</div>
              )}
              {stops.map((stop, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom: i < stops.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ fontSize:12, color:'var(--brand, #f97316)', fontWeight:800, minWidth:42 }}>{stop.arrival_time}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'#e5e7eb' }}>{stop.location_name}</div>
                    <div style={{ fontSize:11, color:'#6b7280' }}>until {stop.departure_time}{stop.notes ? ` · ${stop.notes}` : ''}</div>
                  </div>
                  {stop.id && (
                    <button onClick={() => toggleFavouriteStop(stop.id)} aria-label="Favourite this stop" style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, padding:4, lineHeight:1, flexShrink:0 }}>
                      {favStopIds.has(stop.id) ? '❤️' : '🤍'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* Deals — pre-existing menu_deals, not previously shown to customers anywhere */}
      {data?.deals?.length > 0 && (
        <div style={{ padding:'0 16px 16px' }}>
          <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:4 }}>
            {data.deals.map((d: any) => (
              <div key={d.id} style={{ flexShrink:0, background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.3)', borderRadius:12, padding:'10px 16px', minWidth:160 }}>
                <div style={{ fontSize:11, fontWeight:800, color:'#f97316', textTransform:'uppercase', letterSpacing:0.5 }}>🔥 Deal</div>
                <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginTop:2 }}>{d.name}</div>
                <div style={{ fontSize:14, fontWeight:900, color:'var(--accent,#fdba74)' }}>£{Number(d.deal_price).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order Online banner */}
      {menuItems?.length > 0 && (
        <div style={{ padding:'0 16px 16px' }}>
          {data?.liveStatus?.orderingOpen === false ? (
            <div style={{ width:'100%', padding:'16px', borderRadius:14, background:'rgba(107,114,128,0.15)', border:'1px solid rgba(107,114,128,0.3)', color:'#9ca3af', fontSize:14, fontWeight:700, textAlign:'center' }}>
              🚫 Online ordering is currently closed for this van
            </div>
          ) : (
            <button onClick={() => { if (cartCount > 0) goToCheckout(); else document.getElementById('menu-top')?.scrollIntoView({ behavior:'smooth' }) }} style={{ width:'100%', padding:'16px', borderRadius:14, border:'none', background:'linear-gradient(135deg,var(--brand, #f97316),var(--brand2, #ea580c))', color:'#fff', fontSize:16, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
              🛒 {cartCount > 0 ? `Order Online · £${cartTotal.toFixed(2)} (${cartCount} items)` : 'Order Online — tap + to add items'}
            </button>
          )}
        </div>
      )}

      {/* Menu */}
      {menuItems?.length > 0 ? (
        <div style={{ padding:'0 16px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'0 0 16px', padding:'0 4px' }}>
            <h2 id="menu-top" style={{ fontSize:20, fontWeight:800, color:'#fff', margin:0 }}>Our Menu</h2>
          </div>
          {/* J18 — deterministic search, no AI call involved */}
          <div style={{ padding:'0 4px', marginBottom:16 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search the menu…" aria-label="Search menu"
              style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1px solid #1e2a45', background:'#0d1427', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box', marginBottom:10 }} />
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {[null, 5, 10, 15].map(p => (
                <button key={p ?? 'all'} onClick={() => setMaxPrice(p)} aria-pressed={maxPrice === p}
                  style={{ padding:'6px 12px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:700,
                    border: maxPrice === p ? '1px solid var(--brand,#f97316)' : '1px solid #1e2a45',
                    background: maxPrice === p ? 'color-mix(in srgb, var(--brand, #f97316) 18%, transparent)' : '#0d1427',
                    color: maxPrice === p ? 'var(--brand,#f97316)' : '#9ca3af' }}>
                  {p == null ? 'All prices' : `Under £${p}`}
                </button>
              ))}
            </div>
          </div>
          {sortedCats.length === 0 && search.trim() && (
            <div style={{ padding:'20px 4px', color:'#6b7280', fontSize:14 }}>No items match "{search}"</div>
          )}
          {sortedCats.map(cat => (
            <div key={cat} style={{ marginBottom:24 }}>
              <div style={{ fontSize:13, fontWeight:800, color:'var(--brand, #f97316)', letterSpacing:1, textTransform:'uppercase', marginBottom:10, padding:'0 4px' }}>{cat}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                {byCategory[cat]?.map((item: any) => (
                  <div key={item.id} style={{ background:'#0d1427', borderRadius:10, padding:'12px 14px', display:'flex', alignItems:'center', gap:12 }}>
                    {item.image_url && (
                      <div style={{ width:56, height:56, borderRadius:8, overflow:'hidden', flexShrink:0, background:'#1e2a45' }}>
                        {/* Business-supplied image URLs can be from any host, so a plain
                            lazy-loaded <img> is used rather than next/image (which requires
                            each domain to be pre-allowlisted in next.config.js) — same
                            approach already used for brand.logo above. */}
                        <img src={item.image_url} alt={item.name} loading="lazy" width={56} height={56} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      </div>
                    )}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ fontWeight:700, fontSize:14, color:'#fff' }}>{item.name}</div>
                        <button onClick={() => toggleFavouriteItem(item.id)} aria-label={favItemIds.has(item.id) ? 'Remove from favourites' : 'Add to favourites'} style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, padding:0, lineHeight:1 }}>
                          {favItemIds.has(item.id) ? '❤️' : '🤍'}
                        </button>
                      </div>
                      {item.description && <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{item.description}</div>}
                      {/* J21 — allergens shown only from explicit data; never invented */}
                      <div style={{ fontSize:11, color:'#6b7280', marginTop:3 }}>
                        {item.allergens?.length ? `⚠️ Contains: ${item.allergens.join(', ')}` : 'Allergen info not provided — ask at the van'}
                      </div>
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
          <button onClick={goToCheckout} style={{ width:'100%', padding:'16px', borderRadius:14, border:'none', background:'linear-gradient(135deg,var(--brand, #f97316),var(--brand2, #ea580c))', color:'#fff', fontSize:16, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ background:'rgba(255,255,255,0.2)', borderRadius:8, padding:'2px 10px', fontSize:14 }}>{cartCount}</span>
            <span>Order Online</span>
            <span>£{cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding:'20px', textAlign:'center', borderTop:'1px solid #1e2a45', display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
        <a href="/" style={{ display:'inline-block', padding:'10px 24px', background:'linear-gradient(135deg,var(--brand, #f97316),var(--brand2, #ea580c))', color:'#fff', borderRadius:12, textDecoration:'none', fontWeight:700, fontSize:13 }}>
          Powered by FoodTaxi
        </a>
        {vans?.[0]?.slug && (
          <a href={`/van/${vans[0].slug}/board`} style={{ fontSize:12, color:'#6b7280', textDecoration:'none' }}>View menu board →</a>
        )}
      </div>
    </div>
  )
}
