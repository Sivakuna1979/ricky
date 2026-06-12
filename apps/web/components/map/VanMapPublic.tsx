'use client'
// @ts-nocheck
import { useEffect, useRef, useState, useCallback } from 'react'

/* ─── Types ─────────────────────────────────────────────────────── */
interface GooglePlace {
  place_id: string
  name: string
  address: string
  postcode: string | null
  lat: number | null
  lng: number | null
  rating: number | null
  total_ratings: number
  open_now: boolean | null
  food_type: string
  source: string
}

interface FoodTaxiVan {
  id: string
  name: string
  lat: number
  lng: number
  van_type?: string
  phone?: string
  slug?: string
  isLive?: boolean
}

interface Props {
  height?: string
  centerLat?: number
  centerLng?: number
  searchLabel?: string
  showCards?: boolean
}

/* ─── Constants ──────────────────────────────────────────────────── */
const FOOD_EMOJI: Record<string, string> = {
  fish_and_chips: '🐟', burger: '🍔', pizza: '🍕', coffee: '☕',
  ice_cream: '🍦', kebab: '🌯', street_food: '🌮', dessert: '🍰',
  catering_trailer: '🚐', bakery: '🥐', fast_food: '🍟',
}
const FOOD_LABEL: Record<string, string> = {
  fish_and_chips: 'Fish & Chips', burger: 'Burgers', pizza: 'Pizza',
  coffee: 'Coffee', ice_cream: 'Ice Cream', kebab: 'Kebab',
  street_food: 'Street Food', dessert: 'Desserts',
  catering_trailer: 'Event Catering', bakery: 'Bakery', fast_food: 'Fast Food',
}
const TYPE_FILTERS = [
  { key: 'fish_and_chips', label: 'Fish & Chips' }, { key: 'burger', label: 'Burgers' },
  { key: 'coffee', label: 'Coffee' },               { key: 'pizza', label: 'Pizza' },
  { key: 'ice_cream', label: 'Ice Cream' },         { key: 'kebab', label: 'Kebab' },
  { key: 'street_food', label: 'Street Food' },     { key: 'catering_trailer', label: 'Event Catering' },
]
const TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const TILE_DARK  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

/* ─── Helpers ────────────────────────────────────────────────────── */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8, dLat = ((lat2-lat1)*Math.PI)/180, dLng = ((lng2-lng1)*Math.PI)/180
  const a = Math.sin(dLat/2)**2 + Math.cos((lat1*Math.PI)/180)*Math.cos((lat2*Math.PI)/180)*Math.sin(dLng/2)**2
  return R*2*Math.asin(Math.sqrt(a))
}
function pinHtml(emoji: string, color: string, border = 'rgba(255,255,255,0.85)') {
  return `<div style="background:${color};border:2.5px solid ${border};border-radius:50% 50% 50% 0;width:34px;height:34px;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.35)"><span style="transform:rotate(45deg);font-size:15px">${emoji}</span></div>`
}
function buildInviteMessage(name: string, placeId: string) {
  const url = `https://food-taxi.vercel.app/claim/${placeId}`
  return `Hi ${name}, we found your food business on FoodTaxi! Customers near you are already discovering your listing. Claim your free FoodTaxi profile here: ${url}\n\nOnce registered you can:\n✅ Add your full menu\n✅ Enable live GPS tracking\n✅ Accept online orders\n✅ Take event bookings\n\nIt's completely free to start!`
}

/* ─── Invite Modal ───────────────────────────────────────────────── */
function InviteModal({ place, onClose }: { place: GooglePlace; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [copied, setCopied]   = useState(false)
  const [marked, setMarked]   = useState(false)
  const msg  = buildInviteMessage(place.name, place.place_id)
  const link = `https://food-taxi.vercel.app/claim/${place.place_id}`

  const markInvited = async (method: string) => {
    setLoading(true)
    await fetch('/api/places/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ place_id: place.place_id, name: place.name, method }),
    }).catch(() => {})
    setLoading(false)
    setMarked(true)
  }

  const whatsapp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
    markInvited('whatsapp')
  }
  const sms = () => {
    window.open(`sms:?body=${encodeURIComponent(msg)}`, '_self')
    markInvited('sms')
  }
  const email = () => {
    const sub = encodeURIComponent(`Join FoodTaxi — Claim Your Free Profile`)
    window.open(`mailto:?subject=${sub}&body=${encodeURIComponent(msg)}`, '_self')
    markInvited('email')
  }
  const copy = async () => {
    await navigator.clipboard.writeText(link).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 2000)
    markInvited('copy_link')
  }

  const ov: React.CSSProperties = { position:'fixed', inset:0, background:'rgba(0,0,0,0.72)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }
  const card: React.CSSProperties = { background:'#0e1527', border:'1px solid rgba(255,255,255,0.12)', borderRadius:20, padding:28, width:'100%', maxWidth:420, position:'relative' }

  return (
    <div style={ov} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={card}>
        <button onClick={onClose} style={{ position:'absolute', top:14, right:16, background:'none', border:'none', color:'rgba(255,255,255,0.4)', fontSize:20, cursor:'pointer' }}>✕</button>
        <div style={{ fontSize:19, fontWeight:800, color:'#fff', marginBottom:4 }}>📨 Invite to FoodTaxi</div>
        <div style={{ fontSize:13, color:'rgba(255,255,255,0.45)', marginBottom:18 }}>{place.name}</div>

        {marked && (
          <div style={{ background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:10, padding:'10px 14px', color:'#6ee7b7', fontSize:13, marginBottom:16 }}>
            ✅ Marked as invited in your dashboard
          </div>
        )}

        {/* Invite message preview */}
        <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:14, marginBottom:18, fontSize:12, color:'rgba(255,255,255,0.55)', lineHeight:1.6, whiteSpace:'pre-wrap', maxHeight:140, overflowY:'auto' }}>
          {msg}
        </div>

        {/* Send options */}
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          <button onClick={whatsapp} style={{ padding:'12px 16px', borderRadius:12, border:'none', background:'#25d366', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:18 }}>💬</span> Send via WhatsApp
          </button>
          <button onClick={sms} style={{ padding:'12px 16px', borderRadius:12, border:'none', background:'#3b82f6', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:18 }}>📱</span> Send via SMS
          </button>
          <button onClick={email} style={{ padding:'12px 16px', borderRadius:12, border:'none', background:'#6366f1', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:18 }}>✉️</span> Send via Email
          </button>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={copy} style={{ flex:1, padding:'12px 16px', borderRadius:12, border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.06)', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              {copied ? '✅ Copied!' : '🔗 Copy Invite Link'}
            </button>
            <button onClick={() => markInvited('manual')} disabled={loading} style={{ flex:1, padding:'12px 16px', borderRadius:12, border:'1px solid rgba(16,185,129,0.3)', background:'rgba(16,185,129,0.12)', color:'#6ee7b7', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              {loading ? '…' : '✓ Mark as Invited'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Claim Modal ────────────────────────────────────────────────── */
function ClaimModal({ place, onClose }: { place: GooglePlace; onClose: () => void }) {
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]   = useState(false)
  const [err, setErr]     = useState('')

  const submit = async () => {
    if (!email) { setErr('Email is required'); return }
    setLoading(true); setErr('')
    try {
      const res = await fetch('/api/places/claim', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ place_id:place.place_id, name:place.name, claimant_name:name, claimant_email:email, claimant_phone:phone }) })
      const d = await res.json()
      if (!res.ok) setErr(d.error ?? 'Failed'); else setDone(true)
    } catch { setErr('Network error') }
    finally { setLoading(false) }
  }

  const ov: React.CSSProperties = { position:'fixed', inset:0, background:'rgba(0,0,0,0.72)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }
  const card: React.CSSProperties = { background:'#0e1527', border:'1px solid rgba(255,255,255,0.12)', borderRadius:20, padding:28, width:'100%', maxWidth:420, position:'relative' }
  const inp: React.CSSProperties = { width:'100%', padding:'11px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' }

  return (
    <div style={ov} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={card}>
        <button onClick={onClose} style={{ position:'absolute', top:14, right:16, background:'none', border:'none', color:'rgba(255,255,255,0.4)', fontSize:20, cursor:'pointer' }}>✕</button>
        <div style={{ fontSize:19, fontWeight:800, color:'#fff', marginBottom:4 }}>🏷 Claim This Business</div>
        <div style={{ fontSize:13, color:'rgba(255,255,255,0.45)', marginBottom:18 }}>{place.name}</div>
        {done ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <div style={{ fontSize:16, fontWeight:700, color:'#10b981', marginBottom:8 }}>Claim Submitted!</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.45)' }}>We'll verify your details and contact you within 24 hours.</div>
            <button onClick={onClose} style={{ marginTop:20, padding:'11px 28px', borderRadius:12, border:'none', background:'#f97316', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer' }}>Done</button>
          </div>
        ) : (
          <>
            {err && <div style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'10px 14px', color:'#f87171', fontSize:13, marginBottom:14 }}>⚠ {err}</div>}
            <div style={{ marginBottom:12 }}><label style={{ display:'block', fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.5)', marginBottom:5 }}>Your Name</label><input value={name} onChange={e=>setName(e.target.value)} style={inp} placeholder="John Smith" /></div>
            <div style={{ marginBottom:12 }}><label style={{ display:'block', fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.5)', marginBottom:5 }}>Email Address *</label><input value={email} onChange={e=>setEmail(e.target.value)} type="email" style={inp} placeholder="john@example.com" /></div>
            <div style={{ marginBottom:20 }}><label style={{ display:'block', fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.5)', marginBottom:5 }}>Phone Number</label><input value={phone} onChange={e=>setPhone(e.target.value)} type="tel" style={inp} placeholder="07700 900000" /></div>
            <button onClick={submit} disabled={loading} style={{ width:'100%', padding:'13px', borderRadius:12, border:'none', background:loading?'rgba(249,115,22,0.4)':'linear-gradient(135deg,#f97316,#ea580c)', color:'#fff', fontWeight:800, fontSize:15, cursor:loading?'wait':'pointer' }}>
              {loading ? 'Submitting…' : '🚀 Submit Claim'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ─── Lazy card buttons ──────────────────────────────────────────── */
function LazyCardButtons({ placeId }: { placeId: string }) {
  const [d, setD] = useState<any>(null)
  useEffect(() => {
    let c = false
    fetch(`/api/places/details?place_id=${placeId}`).then(r=>r.json()).then(x=>{ if(!c) setD(x) }).catch(()=>{})
    return () => { c=true }
  }, [placeId])
  if (!d) return null
  return (
    <>
      {d.phone    && <a href={`tel:${d.phone}`} style={{ padding:'8px 12px', background:'rgba(16,185,129,0.2)', border:'1px solid rgba(16,185,129,0.35)', color:'#6ee7b7', borderRadius:10, textDecoration:'none', fontSize:12, fontWeight:700 }}>📞 Call</a>}
      {d.website  && <a href={d.website} target="_blank" rel="noopener noreferrer" style={{ padding:'8px 12px', background:'rgba(59,130,246,0.2)', border:'1px solid rgba(59,130,246,0.35)', color:'#93c5fd', borderRadius:10, textDecoration:'none', fontSize:12, fontWeight:700 }}>🌐 Website</a>}
    </>
  )
}

/* ─── Main Component ─────────────────────────────────────────────── */
export function VanMapPublic({ height='500px', centerLat, centerLng, searchLabel, showCards=false }: Props) {
  const mapRef       = useRef<any>(null)
  const mapElRef     = useRef<HTMLDivElement>(null)
  const tileRef      = useRef<any>(null)
  const gMarkers     = useRef<any[]>([])
  const ftMarkers    = useRef<any[]>([])
  const userMarker   = useRef<any>(null)
  const watchIdRef   = useRef<number|null>(null)
  const lastFetchRef = useRef<number>(0)
  const LRef         = useRef<any>(null)

  const [googlePlaces, setGooglePlaces] = useState<GooglePlace[]>([])
  const [foodTaxiVans, setFoodTaxiVans] = useState<FoodTaxiVan[]>([])
  const [userPos, setUserPos]           = useState<{lat:number;lng:number}|null>(null)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [radiusMiles, setRadiusMiles]   = useState(5)
  const [sortBy, setSortBy]             = useState<'distance'|'rating'>('distance')
  const [claimPlace, setClaimPlace]     = useState<GooglePlace|null>(null)
  const [invitePlace, setInvitePlace]   = useState<GooglePlace|null>(null)
  const [mapDark, setMapDark]           = useState(false)
  const mapDarkRef                      = useRef(false)
  const [showFoodTaxi, setShowFoodTaxi] = useState(true)
  const [showGoogle, setShowGoogle]     = useState(true)
  const [typeFilters, setTypeFilters]   = useState<Set<string>>(new Set())

  const toggleType = (key: string) => setTypeFilters(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n
  })

  /* ── Fetch Google Places ─────────────────────────────────────── */
  const fetchGoogle = useCallback(async (lat: number, lng: number) => {
    const now = Date.now()
    if (now - lastFetchRef.current < 30000) return
    lastFetchRef.current = now
    setLoading(true); setError('')
    try {
      const res  = await fetch(`/api/places/nearby?lat=${lat}&lng=${lng}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      setGooglePlaces(data.results ?? [])
      setRadiusMiles(data.radius_miles ?? 5)
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }, [])

  /* ── Fetch FoodTaxi vans ─────────────────────────────────────── */
  const fetchFoodTaxi = useCallback(async (lat: number, lng: number) => {
    try {
      const res  = await fetch(`/api/map-data?lat=${lat}&lng=${lng}&radius=50`)
      const data = await res.json()
      const vans: FoodTaxiVan[] = []
      for (const v of data.live_vans  ?? []) vans.push({ id:v.id, name:v.vans?.name??'FoodTaxi Van', lat:v.latitude, lng:v.longitude, van_type:v.vans?.van_type, phone:v.vans?.phone, slug:v.vans?.slug, isLive:true })
      for (const b of data.businesses ?? []) vans.push({ id:b.id, name:b.name, lat:b.latitude, lng:b.longitude, van_type:b.van_type, phone:b.phone, slug:b.slug, isLive:false })
      setFoodTaxiVans(vans)
    } catch {}
  }, [])

  /* ── Init Leaflet ────────────────────────────────────────────── */
  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return
    import('leaflet').then((L) => {
      LRef.current = L
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })
      const map = L.map(mapElRef.current!, { zoomControl:true, scrollWheelZoom:true })
      tileRef.current = L.tileLayer(TILE_LIGHT, { attribution:'© OpenStreetMap contributors © CARTO', maxZoom:19 }).addTo(map)
      map.setView([centerLat??51.505, centerLng??-0.09], 13)
      mapRef.current = map
      if (centerLat!=null && centerLng!=null) { lastFetchRef.current=0; fetchGoogle(centerLat,centerLng); fetchFoodTaxi(centerLat,centerLng) }
      if (navigator.geolocation) {
        const id = navigator.geolocation.watchPosition((pos) => {
          const { latitude:plat, longitude:plng } = pos.coords
          setUserPos({ lat:plat, lng:plng })
          if (userMarker.current) userMarker.current.setLatLng([plat,plng])
          else {
            const icon = L.divIcon({ className:'', html:'<div style="width:18px;height:18px;border-radius:50%;background:#60a5fa;border:3px solid #fff;box-shadow:0 0 10px rgba(96,165,250,0.9)"></div>', iconSize:[18,18], iconAnchor:[9,9] })
            userMarker.current = L.marker([plat,plng],{icon}).addTo(map).bindPopup('<b>📍 You are here</b>')
          }
          if (centerLat==null || centerLng==null) { fetchGoogle(plat,plng); fetchFoodTaxi(plat,plng) }
        }, ()=>{}, { enableHighAccuracy:true, timeout:15000, maximumAge:30000 })
        watchIdRef.current = id
      }
    })
    return () => {
      if (watchIdRef.current!=null) navigator.geolocation.clearWatch(watchIdRef.current)
      if (mapRef.current) { mapRef.current.remove(); mapRef.current=null }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapRef.current || centerLat==null || centerLng==null) return
    mapRef.current.setView([centerLat,centerLng],13)
    lastFetchRef.current=0; fetchGoogle(centerLat,centerLng); fetchFoodTaxi(centerLat,centerLng)
  }, [centerLat, centerLng]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Google markers ──────────────────────────────────────────── */
  useEffect(() => {
    if (!mapRef.current || !LRef.current) return
    const L = LRef.current
    gMarkers.current.forEach(m=>m.remove()); gMarkers.current=[]
    if (!showGoogle) return
    const pinColor = mapDark ? '#f97316' : '#c2410c'
    const pinBorder = mapDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.25)'
    googlePlaces.filter(p => p.lat!=null && p.lng!=null && (typeFilters.size===0||typeFilters.has(p.food_type))).forEach(p => {
      const emoji = FOOD_EMOJI[p.food_type]??'🍽️'
      const icon  = L.divIcon({ className:'', html:pinHtml(emoji,pinColor,pinBorder), iconSize:[34,34], iconAnchor:[17,34], popupAnchor:[0,-36] })
      const dist  = userPos ? haversine(userPos.lat,userPos.lng,p.lat!,p.lng!) : null
      const eta   = dist ? Math.round((dist/30)*60) : null
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`
      const pid   = `pu-${p.place_id}`
      const textColor = mapDark ? '#fff' : '#111'
      const subColor  = mapDark ? '#999' : '#555'
      const addrColor = mapDark ? '#aaa' : '#555'
      const popup = L.popup({ maxWidth:285 }).setContent(`
        <div id="${pid}" style="font-family:system-ui,sans-serif;min-width:220px">
          <div style="font-weight:800;font-size:15px;margin-bottom:3px;color:${textColor}">${emoji} ${p.name}</div>
          <div style="font-size:11px;font-weight:700;color:#f97316;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">${FOOD_LABEL[p.food_type]??'Food Business'}</div>
          ${p.rating!=null?`<div style="color:#f59e0b;font-size:13px;margin-bottom:4px;font-weight:600">★ ${p.rating.toFixed(1)} <span style="color:${subColor};font-weight:400">(${p.total_ratings})</span></div>`:''}
          ${p.open_now===true?'<span style="background:#10b981;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700">OPEN NOW</span>':''}
          ${p.open_now===false?'<span style="background:#ef4444;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700">CLOSED</span>':''}
          <div style="font-size:12px;color:${addrColor};margin-top:7px;line-height:1.4">${p.address}</div>
          ${dist!=null?`<div style="font-size:12px;color:${subColor};margin-top:4px">📍 ${dist.toFixed(1)} mi · ~${eta} min</div>`:''}
          <div id="${pid}-det" style="margin-top:8px;font-size:12px;color:${subColor}">Loading…</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:10px">
            <a href="${mapsUrl}" target="_blank" rel="noopener" style="padding:6px 11px;background:#f97316;color:#fff;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700">🗺 Navigate</a>
            <span id="${pid}-call"></span><span id="${pid}-web"></span>
            <button onclick="window.__claimPlace('${p.place_id}')" style="padding:6px 11px;background:#6366f1;color:#fff;border-radius:8px;font-size:12px;font-weight:700;border:none;cursor:pointer">🏷 Claim</button>
            <button onclick="window.__invitePlace('${p.place_id}')" style="padding:6px 11px;background:#059669;color:#fff;border-radius:8px;font-size:12px;font-weight:700;border:none;cursor:pointer">📨 Invite</button>
          </div>
        </div>`)
      const marker = L.marker([p.lat,p.lng],{icon}).addTo(mapRef.current).bindPopup(popup)
      marker.on('popupopen', async () => {
        try {
          const d = await fetch(`/api/places/details?place_id=${p.place_id}`).then(r=>r.json())
          const detEl=document.getElementById(`${pid}-det`), callEl=document.getElementById(`${pid}-call`), webEl=document.getElementById(`${pid}-web`)
          if (detEl) detEl.textContent=''
          if (d.phone && callEl) callEl.innerHTML=`<a href="tel:${d.phone}" style="padding:6px 11px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700">📞 ${d.phone}</a>`
          if (d.website && webEl) webEl.innerHTML=`<a href="${d.website}" target="_blank" rel="noopener" style="padding:6px 11px;background:#3b82f6;color:#fff;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700">🌐 Website</a>`
          if (!d.phone && !d.website && detEl) detEl.textContent='No phone or website on record.'
        } catch {}
      })
      gMarkers.current.push(marker)
    })
  }, [googlePlaces, showGoogle, typeFilters, userPos, mapDark])

  /* ── FoodTaxi markers ────────────────────────────────────────── */
  useEffect(() => {
    if (!mapRef.current || !LRef.current) return
    const L = LRef.current
    ftMarkers.current.forEach(m=>m.remove()); ftMarkers.current=[]
    if (!showFoodTaxi) return
    foodTaxiVans.forEach(v => {
      if (!v.lat||!v.lng) return
      const color = v.isLive?'#22c55e':'#f97316'
      const border = mapDark?'rgba(255,255,255,0.85)':'rgba(0,0,0,0.2)'
      const icon  = L.divIcon({ className:'', html:pinHtml('🚐',color,border), iconSize:[34,34], iconAnchor:[17,34], popupAnchor:[0,-36] })
      const dist  = userPos?haversine(userPos.lat,userPos.lng,v.lat,v.lng):null
      const eta   = dist?Math.round((dist/30)*60):null
      const mapsUrl=`https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}&travelmode=driving`
      const textColor = mapDark?'#fff':'#111'
      const popup=`<div style="font-family:system-ui,sans-serif;min-width:200px">
        <div style="font-weight:800;font-size:15px;margin-bottom:4px;color:${textColor}">🚐 ${v.name}</div>
        ${v.isLive?'<span style="background:#22c55e;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:800">🟢 LIVE</span>':'<span style="background:#f97316;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700">✓ Registered</span>'}
        ${dist!=null?`<div style="font-size:12px;color:#888;margin-top:6px">📍 ${dist.toFixed(1)} mi · ~${eta} min</div>`:''}
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">
          ${v.phone?`<a href="tel:${v.phone}" style="padding:6px 11px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700">📞 Call</a>`:''}
          <a href="${mapsUrl}" target="_blank" rel="noopener" style="padding:6px 11px;background:#f97316;color:#fff;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700">🗺 Navigate</a>
          ${v.slug?`<a href="/van/${v.slug}" style="padding:6px 11px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700">🍽 Menu</a>`:''}
        </div>
      </div>`
      ftMarkers.current.push(L.marker([v.lat,v.lng],{icon}).addTo(mapRef.current).bindPopup(popup))
    })
  }, [foodTaxiVans, showFoodTaxi, userPos, mapDark])

  /* ── Expose handlers to popup buttons ───────────────────────── */
  useEffect(() => {
    (window as any).__claimPlace  = (id:string) => { const p=googlePlaces.find(x=>x.place_id===id); if(p) setClaimPlace(p) }
    ;(window as any).__invitePlace = (id:string) => { const p=googlePlaces.find(x=>x.place_id===id); if(p) setInvitePlace(p) }
    return () => { delete (window as any).__claimPlace; delete (window as any).__invitePlace }
  }, [googlePlaces])

  /* ── Sorted cards ───────────────────────────────────────────── */
  const visible = googlePlaces.filter(p => p.lat!=null&&p.lng!=null&&(typeFilters.size===0||typeFilters.has(p.food_type)))
  const sorted  = [...visible].sort((a,b) => {
    if (sortBy==='rating') return (b.rating??0)-(a.rating??0)
    if (!userPos) return 0
    return haversine(userPos.lat,userPos.lng,a.lat!,a.lng!)-haversine(userPos.lat,userPos.lng,b.lat!,b.lng!)
  })

  const tog = (on:boolean, c='#f97316'): React.CSSProperties => ({ padding:'6px 13px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background:on?c:'rgba(255,255,255,0.08)', color:on?'#fff':'rgba(255,255,255,0.4)' })

  return (
    <div>
      {/* ── Controls ── */}
      <div style={{ marginBottom:12, display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
        <button onClick={()=>setShowFoodTaxi(v=>!v)} style={tog(showFoodTaxi,'#22c55e')}>🚐 FoodTaxi Vans</button>
        <button onClick={()=>setShowGoogle(v=>!v)}   style={tog(showGoogle,'#f97316')}>🌍 Google Businesses</button>
        {/* Map style toggle */}
        <div style={{ marginLeft:'auto', display:'flex', background:'rgba(255,255,255,0.07)', borderRadius:20, overflow:'hidden', border:'1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={()=>{ mapDarkRef.current=false; setMapDark(false); if(mapRef.current&&LRef.current){const L=LRef.current;if(tileRef.current)tileRef.current.remove();tileRef.current=L.tileLayer(TILE_LIGHT,{attribution:'© OpenStreetMap contributors © CARTO',maxZoom:19}).addTo(mapRef.current)} }} style={{ padding:'6px 14px', border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background:!mapDark?'#fff':'transparent', color:!mapDark?'#111':'rgba(255,255,255,0.5)', transition:'background .15s' }}>☀️ Light</button>
          <button onClick={()=>{ mapDarkRef.current=true; setMapDark(true); if(mapRef.current&&LRef.current){const L=LRef.current;if(tileRef.current)tileRef.current.remove();tileRef.current=L.tileLayer(TILE_DARK,{attribution:'© OpenStreetMap contributors © CARTO',maxZoom:19}).addTo(mapRef.current)} }} style={{ padding:'6px 14px', border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background:mapDark?'#334155':'transparent', color:mapDark?'#fff':'rgba(255,255,255,0.5)', transition:'background .15s' }}>🌙 Dark</button>
        </div>
      </div>

      {/* ── Type chips ── */}
      <div style={{ marginBottom:12, display:'flex', flexWrap:'wrap', gap:6 }}>
        {TYPE_FILTERS.map(t => {
          const on = typeFilters.has(t.key)
          return <button key={t.key} onClick={()=>toggleType(t.key)} style={{ padding:'4px 10px', borderRadius:14, border:`1px solid ${on?'#f97316':'rgba(255,255,255,0.1)'}`, background:on?'rgba(249,115,22,0.18)':'transparent', color:on?'#f97316':'rgba(255,255,255,0.4)', fontSize:11, fontWeight:600, cursor:'pointer' }}>{FOOD_EMOJI[t.key]} {t.label}</button>
        })}
        {typeFilters.size>0 && <button onClick={()=>setTypeFilters(new Set())} style={{ padding:'4px 10px', borderRadius:14, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.3)', fontSize:11, cursor:'pointer' }}>✕ Clear</button>}
      </div>

      {/* ── Map ── */}
      <div style={{ position:'relative', borderRadius:16, overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)' }}>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <div ref={mapElRef} style={{ height, width:'100%' }} />
        {loading && <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', background:'rgba(0,0,0,0.8)', color:'#fff', padding:'8px 18px', borderRadius:20, fontSize:13, fontWeight:600, zIndex:1000, backdropFilter:'blur(8px)', whiteSpace:'nowrap' }}>🔍 Searching food businesses…</div>}
        {error   && <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', background:'rgba(239,68,68,0.9)', color:'#fff', padding:'8px 18px', borderRadius:20, fontSize:13, fontWeight:600, zIndex:1000 }}>⚠ {error}</div>}
        {!loading && googlePlaces.length>0 && <div style={{ position:'absolute', bottom:12, left:12, background:'rgba(0,0,0,0.72)', color:'#fff', padding:'5px 12px', borderRadius:12, fontSize:12, fontWeight:600, zIndex:1000 }}>{googlePlaces.length} food businesses · {radiusMiles} mi radius</div>}
        {/* Legend */}
        <div style={{ position:'absolute', top:12, right:12, background:mapDark?'rgba(0,0,0,0.72)':'rgba(255,255,255,0.88)', backdropFilter:'blur(8px)', padding:'8px 12px', borderRadius:12, zIndex:1000, display:'flex', flexDirection:'column', gap:5 }}>
          {[['#22c55e','Live FoodTaxi Van'],['#f97316','Google Business'],['#60a5fa','You Are Here']].map(([c,l])=>(
            <div key={l} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:mapDark?'rgba(255,255,255,0.7)':'#333' }}>
              <span style={{ width:10,height:10,borderRadius:'50%',background:c,display:'inline-block' }}/>{l}
            </div>
          ))}
        </div>
      </div>

      {/* ── Result cards ── */}
      {showCards && sorted.length>0 && (
        <div style={{ marginTop:24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
            <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', margin:0 }}>
              {searchLabel?`Food near ${searchLabel}`:'Nearby food businesses'}
              <span style={{ fontSize:13, fontWeight:500, color:'rgba(255,255,255,0.3)', marginLeft:8 }}>({sorted.length})</span>
            </h2>
            <div style={{ display:'flex', gap:6 }}>
              {(['distance','rating'] as const).map(s=><button key={s} onClick={()=>setSortBy(s)} style={tog(sortBy===s)}>{s==='distance'?'📍 Nearest':'⭐ Top Rated'}</button>)}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))', gap:14 }}>
            {sorted.map(p => {
              const emoji=FOOD_EMOJI[p.food_type]??'🍽️'
              const dist=userPos?haversine(userPos.lat,userPos.lng,p.lat!,p.lng!):null
              const eta=dist?Math.round((dist/30)*60):null
              const mapsUrl=`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`
              return (
                <div key={p.place_id} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:18, display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                    <div style={{ fontWeight:800, fontSize:15, color:'#fff', lineHeight:1.3 }}>{emoji} {p.name}</div>
                    {p.open_now===true  && <span style={{ background:'#10b981',color:'#fff',padding:'2px 8px',borderRadius:10,fontSize:10,fontWeight:700,flexShrink:0 }}>OPEN</span>}
                    {p.open_now===false && <span style={{ background:'#ef4444',color:'#fff',padding:'2px 8px',borderRadius:10,fontSize:10,fontWeight:700,flexShrink:0 }}>CLOSED</span>}
                  </div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#f97316', textTransform:'uppercase', letterSpacing:'.05em' }}>{FOOD_LABEL[p.food_type]??'Food Business'}</div>
                  {p.rating!=null && <div style={{ fontSize:13, color:'#f59e0b', fontWeight:600 }}>★ {p.rating.toFixed(1)} <span style={{ color:'rgba(255,255,255,0.3)', fontWeight:400 }}>({p.total_ratings} reviews)</span></div>}
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', lineHeight:1.5 }}>{p.address}</div>
                  {dist!=null && <div style={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}>📍 {dist.toFixed(1)} mi · ~{eta} min drive</div>}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ padding:'8px 12px', background:'linear-gradient(135deg,#f97316,#ea580c)', color:'#fff', borderRadius:10, textDecoration:'none', fontSize:12, fontWeight:700 }}>🗺 Directions</a>
                    <LazyCardButtons placeId={p.place_id} />
                    <button onClick={()=>setInvitePlace(p)} style={{ padding:'8px 12px', background:'rgba(5,150,105,0.2)', border:'1px solid rgba(5,150,105,0.35)', color:'#6ee7b7', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer' }}>📨 Invite</button>
                    <button onClick={()=>setClaimPlace(p)}  style={{ padding:'8px 12px', background:'rgba(99,102,241,0.2)', border:'1px solid rgba(99,102,241,0.35)', color:'#a5b4fc', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer' }}>🏷 Claim</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {invitePlace && <InviteModal place={invitePlace} onClose={()=>setInvitePlace(null)} />}
      {claimPlace  && <ClaimModal  place={claimPlace}  onClose={()=>setClaimPlace(null)}  />}
    </div>
  )
}
