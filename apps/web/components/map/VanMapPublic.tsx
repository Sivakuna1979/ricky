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
  fish_and_chips:   '🐟',
  burger:           '🍔',
  pizza:            '🍕',
  coffee:           '☕',
  ice_cream:        '🍦',
  kebab:            '🌯',
  street_food:      '🌮',
  dessert:          '🍰',
  catering_trailer: '🚐',
  bakery:           '🥐',
  fast_food:        '🍟',
}

const FOOD_LABEL: Record<string, string> = {
  fish_and_chips:   'Fish & Chips',
  burger:           'Burgers',
  pizza:            'Pizza',
  coffee:           'Coffee',
  ice_cream:        'Ice Cream',
  kebab:            'Kebab',
  street_food:      'Street Food',
  dessert:          'Desserts',
  catering_trailer: 'Event Catering',
  bakery:           'Bakery',
  fast_food:        'Fast Food',
}

const TYPE_FILTERS = [
  { key: 'fish_and_chips', label: 'Fish & Chips' },
  { key: 'burger',         label: 'Burgers'       },
  { key: 'coffee',         label: 'Coffee'         },
  { key: 'pizza',          label: 'Pizza'          },
  { key: 'ice_cream',      label: 'Ice Cream'      },
  { key: 'kebab',          label: 'Kebab'          },
  { key: 'street_food',    label: 'Street Food'    },
  { key: 'catering_trailer', label: 'Event Catering' },
]

/* ─── Helpers ────────────────────────────────────────────────────── */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function pinHtml(emoji: string, color: string) {
  return `<div style="background:${color};border:2px solid rgba(255,255,255,0.85);border-radius:50% 50% 50% 0;width:34px;height:34px;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.45)"><span style="transform:rotate(45deg);font-size:15px">${emoji}</span></div>`
}

/* ─── Claim Modal ────────────────────────────────────────────────── */
function ClaimModal({ place, onClose }: { place: GooglePlace; onClose: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    if (!email) { setErr('Email is required'); return }
    setLoading(true); setErr('')
    try {
      const res = await fetch('/api/places/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ place_id: place.place_id, name: place.name, claimant_name: name, claimant_email: email, claimant_phone: phone }),
      })
      const data = await res.json()
      if (!res.ok) setErr(data.error ?? 'Failed')
      else setDone(true)
    } catch { setErr('Network error') }
    finally { setLoading(false) }
  }

  const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
  const card: React.CSSProperties = { background: '#0e1527', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, position: 'relative' }
  const inp: React.CSSProperties = { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={card}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>🏷 Claim This Business</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>{place.name}</div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981', marginBottom: 8 }}>Claim Submitted!</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>We'll verify your details and contact you within 24 hours to complete the claim.</div>
            <button onClick={onClose} style={{ marginTop: 20, padding: '11px 28px', borderRadius: 12, border: 'none', background: '#f97316', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Done</button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20, lineHeight: 1.6 }}>
              Is this your business? Claim it to add your menu, enable GPS tracking, accept online orders, and receive payments through FoodTaxi.
            </p>
            {err && <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 16 }}>⚠ {err}</div>}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Your Name</label>
              <input value={name} onChange={e => setName(e.target.value)} style={inp} placeholder="John Smith" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Email Address *</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" style={inp} placeholder="john@example.com" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Phone Number</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" style={inp} placeholder="07700 900000" />
            </div>
            <button onClick={submit} disabled={loading} style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: loading ? 'rgba(249,115,22,0.4)' : 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: loading ? 'wait' : 'pointer' }}>
              {loading ? 'Submitting…' : '🚀 Submit Claim'}
            </button>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 12, textAlign: 'center' }}>
              We'll verify your ownership via email and phone before granting access.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────────────────── */
export function VanMapPublic({ height = '500px', centerLat, centerLng, searchLabel, showCards = false }: Props) {
  const mapRef       = useRef<any>(null)
  const mapElRef     = useRef<HTMLDivElement>(null)
  const gMarkers     = useRef<any[]>([])  // Google Places markers
  const ftMarkers    = useRef<any[]>([])  // FoodTaxi van markers
  const userMarker   = useRef<any>(null)
  const watchIdRef   = useRef<number | null>(null)
  const lastFetchRef = useRef<number>(0)
  const LRef         = useRef<any>(null)

  const [googlePlaces, setGooglePlaces]   = useState<GooglePlace[]>([])
  const [foodTaxiVans, setFoodTaxiVans]   = useState<FoodTaxiVan[]>([])
  const [userPos, setUserPos]             = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [radiusMiles, setRadiusMiles]     = useState(5)
  const [sortBy, setSortBy]               = useState<'distance' | 'rating'>('distance')
  const [claimPlace, setClaimPlace]       = useState<GooglePlace | null>(null)

  // Layer toggles
  const [showFoodTaxi, setShowFoodTaxi]   = useState(true)
  const [showGoogle, setShowGoogle]       = useState(true)
  const [typeFilters, setTypeFilters]     = useState<Set<string>>(new Set())  // empty = all

  const toggleType = (key: string) => {
    setTypeFilters(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  /* ── Fetch Google Places ─────────────────────────────────────── */
  const fetchGoogle = useCallback(async (lat: number, lng: number) => {
    const now = Date.now()
    if (now - lastFetchRef.current < 30000) return
    lastFetchRef.current = now
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/places/nearby?lat=${lat}&lng=${lng}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      setGooglePlaces(data.results ?? [])
      setRadiusMiles(data.radius_miles ?? 5)
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }, [])

  /* ── Fetch registered FoodTaxi vans ──────────────────────────── */
  const fetchFoodTaxi = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(`/api/map-data?lat=${lat}&lng=${lng}&radius=50`)
      const data = await res.json()
      const vans: FoodTaxiVan[] = []
      for (const v of data.live_vans ?? []) {
        vans.push({ id: v.id, name: v.vans?.name ?? 'FoodTaxi Van', lat: v.latitude, lng: v.longitude, van_type: v.vans?.van_type, phone: v.vans?.phone, slug: v.vans?.slug, isLive: true })
      }
      for (const b of data.businesses ?? []) {
        vans.push({ id: b.id, name: b.name, lat: b.latitude, lng: b.longitude, van_type: b.van_type, phone: b.phone, slug: b.slug, isLive: false })
      }
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
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const initLat = centerLat ?? 51.505
      const initLng = centerLng ?? -0.09
      const map = L.map(mapElRef.current!, { zoomControl: true, scrollWheelZoom: true })
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
      }).addTo(map)
      map.setView([initLat, initLng], 13)
      mapRef.current = map

      if (centerLat != null && centerLng != null) {
        lastFetchRef.current = 0
        fetchGoogle(centerLat, centerLng)
        fetchFoodTaxi(centerLat, centerLng)
      }

      // GPS watch
      if (navigator.geolocation) {
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude: plat, longitude: plng } = pos.coords
            setUserPos({ lat: plat, lng: plng })
            if (userMarker.current) {
              userMarker.current.setLatLng([plat, plng])
            } else {
              const icon = L.divIcon({
                className: '',
                html: '<div style="width:18px;height:18px;border-radius:50%;background:#60a5fa;border:3px solid #fff;box-shadow:0 0 10px rgba(96,165,250,0.9)"></div>',
                iconSize: [18, 18], iconAnchor: [9, 9],
              })
              userMarker.current = L.marker([plat, plng], { icon }).addTo(map).bindPopup('<b>📍 You are here</b>')
            }
            if (centerLat == null || centerLng == null) {
              fetchGoogle(plat, plng)
              fetchFoodTaxi(plat, plng)
            }
          },
          () => {},
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
        )
        watchIdRef.current = id
      }
    })

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Re-centre when props change ────────────────────────────── */
  useEffect(() => {
    if (!mapRef.current || centerLat == null || centerLng == null) return
    mapRef.current.setView([centerLat, centerLng], 13)
    lastFetchRef.current = 0
    fetchGoogle(centerLat, centerLng)
    fetchFoodTaxi(centerLat, centerLng)
  }, [centerLat, centerLng]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Render Google Places markers ───────────────────────────── */
  useEffect(() => {
    if (!mapRef.current || !LRef.current) return
    const L = LRef.current
    gMarkers.current.forEach(m => m.remove())
    gMarkers.current = []
    if (!showGoogle) return

    const visible = googlePlaces.filter(p =>
      p.lat != null && p.lng != null &&
      (typeFilters.size === 0 || typeFilters.has(p.food_type))
    )

    visible.forEach((p) => {
      const emoji = FOOD_EMOJI[p.food_type] ?? '🍽️'
      const icon = L.divIcon({
        className: '',
        html: pinHtml(emoji, '#f97316'),
        iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -36],
      })

      const dist = userPos ? haversine(userPos.lat, userPos.lng, p.lat!, p.lng!) : null
      const eta  = dist ? Math.round((dist / 30) * 60) : null
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`

      const marker = L.marker([p.lat, p.lng], { icon }).addTo(mapRef.current)

      // Build popup content (details loaded lazily)
      const popupId = `popup-${p.place_id}`
      const popup = L.popup({ maxWidth: 280 }).setContent(`
        <div id="${popupId}" style="font-family:system-ui,sans-serif;min-width:220px">
          <div style="font-weight:800;font-size:15px;margin-bottom:4px;color:#111">${emoji} ${p.name}</div>
          <div style="font-size:11px;font-weight:700;color:#f97316;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">${FOOD_LABEL[p.food_type] ?? 'Food Business'}</div>
          ${p.rating != null ? `<div style="color:#f59e0b;font-size:13px;margin-bottom:4px;font-weight:600">★ ${p.rating.toFixed(1)} <span style="color:#999;font-weight:400">(${p.total_ratings} reviews)</span></div>` : ''}
          ${p.open_now === true  ? '<span style="background:#10b981;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700">OPEN NOW</span>' : ''}
          ${p.open_now === false ? '<span style="background:#ef4444;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700">CLOSED</span>' : ''}
          <div style="font-size:12px;color:#666;margin-top:8px;line-height:1.4">${p.address}</div>
          ${dist != null ? `<div style="font-size:12px;color:#888;margin-top:4px">📍 ${dist.toFixed(1)} mi · ~${eta} min drive</div>` : ''}
          <div id="${popupId}-details" style="margin-top:10px;font-size:12px;color:#888">Loading details…</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">
            <a href="${mapsUrl}" target="_blank" rel="noopener" style="padding:7px 12px;background:#f97316;color:#fff;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700">🗺 Navigate</a>
            <span id="${popupId}-call-btn"></span>
            <span id="${popupId}-web-btn"></span>
            <button onclick="window.__claimPlace('${p.place_id}')" style="padding:7px 12px;background:#6366f1;color:#fff;border-radius:8px;font-size:12px;font-weight:700;border:none;cursor:pointer">🏷 Claim</button>
          </div>
        </div>
      `)

      marker.bindPopup(popup)

      marker.on('popupopen', async () => {
        // Lazy-load place details
        try {
          const res = await fetch(`/api/places/details?place_id=${p.place_id}`)
          const d = await res.json()
          const detailEl  = document.getElementById(`${popupId}-details`)
          const callBtn   = document.getElementById(`${popupId}-call-btn`)
          const webBtn    = document.getElementById(`${popupId}-web-btn`)

          if (detailEl) detailEl.textContent = ''
          if (d.phone && callBtn) {
            callBtn.innerHTML = `<a href="tel:${d.phone}" style="padding:7px 12px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700">📞 ${d.phone}</a>`
          }
          if (d.website && webBtn) {
            webBtn.innerHTML = `<a href="${d.website}" target="_blank" rel="noopener" style="padding:7px 12px;background:#3b82f6;color:#fff;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700">🌐 Website</a>`
          }
          if (!d.phone && !d.website && detailEl) {
            detailEl.textContent = 'No phone or website on record.'
          }
        } catch {}
      })

      gMarkers.current.push(marker)
    })
  }, [googlePlaces, showGoogle, typeFilters, userPos])

  /* ── Render FoodTaxi markers ────────────────────────────────── */
  useEffect(() => {
    if (!mapRef.current || !LRef.current) return
    const L = LRef.current
    ftMarkers.current.forEach(m => m.remove())
    ftMarkers.current = []
    if (!showFoodTaxi) return

    foodTaxiVans.forEach((v) => {
      if (!v.lat || !v.lng) return
      const color = v.isLive ? '#4ade80' : '#f97316'
      const icon = L.divIcon({
        className: '',
        html: pinHtml('🚐', color),
        iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -36],
      })
      const dist = userPos ? haversine(userPos.lat, userPos.lng, v.lat, v.lng) : null
      const eta  = dist ? Math.round((dist / 30) * 60) : null
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}&travelmode=driving`

      const popup = `
        <div style="font-family:system-ui,sans-serif;min-width:200px">
          <div style="font-weight:800;font-size:15px;margin-bottom:4px;color:#111">🚐 ${v.name}</div>
          ${v.isLive ? '<span style="background:#4ade80;color:#000;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:800">🟢 LIVE ON FOODTAXI</span>' : '<span style="background:#f97316;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700">✓ Registered</span>'}
          ${dist != null ? `<div style="font-size:12px;color:#888;margin-top:6px">📍 ${dist.toFixed(1)} mi · ~${eta} min drive</div>` : ''}
          ${v.phone ? `<a href="tel:${v.phone}" style="display:inline-block;margin-top:8px;padding:7px 12px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700">📞 ${v.phone}</a>` : ''}
          <a href="${mapsUrl}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;margin-left:6px;padding:7px 12px;background:#f97316;color:#fff;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700">🗺 Navigate</a>
          ${v.slug ? `<br><a href="/van/${v.slug}" style="display:inline-block;margin-top:8px;padding:7px 12px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700">🍽 View Menu</a>` : ''}
        </div>`

      const m = L.marker([v.lat, v.lng], { icon }).addTo(mapRef.current).bindPopup(popup)
      ftMarkers.current.push(m)
    })
  }, [foodTaxiVans, showFoodTaxi, userPos])

  /* ── Expose claim handler to popup buttons ──────────────────── */
  useEffect(() => {
    (window as any).__claimPlace = (placeId: string) => {
      const place = googlePlaces.find(p => p.place_id === placeId)
      if (place) setClaimPlace(place)
    }
    return () => { delete (window as any).__claimPlace }
  }, [googlePlaces])

  /* ── Sorted cards ───────────────────────────────────────────── */
  const visiblePlaces = googlePlaces.filter(p =>
    p.lat != null && p.lng != null &&
    (typeFilters.size === 0 || typeFilters.has(p.food_type))
  )
  const sortedPlaces = [...visiblePlaces].sort((a, b) => {
    if (sortBy === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
    if (!userPos) return 0
    return haversine(userPos.lat, userPos.lng, a.lat!, a.lng!) - haversine(userPos.lat, userPos.lng, b.lat!, b.lng!)
  })

  /* ── Styles ─────────────────────────────────────────────────── */
  const toggleBtn = (active: boolean, color = '#f97316') => ({
    padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 700,
    background: active ? color : 'rgba(255,255,255,0.08)',
    color: active ? '#fff' : 'rgba(255,255,255,0.45)',
    transition: 'all .15s',
  })

  return (
    <div>
      {/* ── Layer + type filter controls ── */}
      <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {/* Layer toggles */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => setShowFoodTaxi(v => !v)} style={toggleBtn(showFoodTaxi, '#4ade80')}>
            🚐 FoodTaxi Vans
          </button>
          <button onClick={() => setShowGoogle(v => !v)} style={toggleBtn(showGoogle, '#f97316')}>
            🌍 Google Food Businesses
          </button>
        </div>
        {/* Type filter chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {TYPE_FILTERS.map(t => {
            const active = typeFilters.has(t.key)
            return (
              <button key={t.key} onClick={() => toggleType(t.key)} style={{
                padding: '4px 10px', borderRadius: 14, border: `1px solid ${active ? '#f97316' : 'rgba(255,255,255,0.1)'}`,
                background: active ? 'rgba(249,115,22,0.2)' : 'transparent',
                color: active ? '#f97316' : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>
                {FOOD_EMOJI[t.key]} {t.label}
              </button>
            )
          })}
          {typeFilters.size > 0 && (
            <button onClick={() => setTypeFilters(new Set())} style={{ padding: '4px 10px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.35)', fontSize: 11, cursor: 'pointer' }}>
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Map ── */}
      <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <div ref={mapElRef} style={{ height, width: '100%' }} />

        {loading && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, zIndex: 1000, backdropFilter: 'blur(8px)', whiteSpace: 'nowrap' }}>
            🔍 Searching food businesses…
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(239,68,68,0.9)', color: '#fff', padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, zIndex: 1000, whiteSpace: 'nowrap' }}>
            ⚠ {error}
          </div>
        )}
        {!loading && googlePlaces.length > 0 && (
          <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '6px 14px', borderRadius: 12, fontSize: 12, fontWeight: 600, zIndex: 1000, backdropFilter: 'blur(6px)' }}>
            {googlePlaces.length} food businesses within {radiusMiles} miles
          </div>
        )}

        {/* Legend */}
        <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', padding: '8px 12px', borderRadius: 12, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} /> Live FoodTaxi Van
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f97316', display: 'inline-block' }} /> Google Food Business
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }} /> You Are Here
          </div>
        </div>
      </div>

      {/* ── Result cards ── */}
      {showCards && sortedPlaces.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>
              {searchLabel ? `Food businesses near ${searchLabel}` : 'Nearby food businesses'}
              <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.35)', marginLeft: 8 }}>({sortedPlaces.length})</span>
            </h2>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['distance', 'rating'] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)} style={toggleBtn(sortBy === s)}>
                  {s === 'distance' ? '📍 Nearest' : '⭐ Top Rated'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 14 }}>
            {sortedPlaces.map(p => {
              const emoji = FOOD_EMOJI[p.food_type] ?? '🍽️'
              const dist  = userPos ? haversine(userPos.lat, userPos.lng, p.lat!, p.lng!) : null
              const eta   = dist ? Math.round((dist / 30) * 60) : null
              const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`
              return (
                <div key={p.place_id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', lineHeight: 1.3 }}>{emoji} {p.name}</div>
                    {p.open_now === true  && <span style={{ background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>OPEN</span>}
                    {p.open_now === false && <span style={{ background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>CLOSED</span>}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '.05em' }}>{FOOD_LABEL[p.food_type] ?? 'Food Business'}</div>
                  {p.rating != null && (
                    <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>
                      ★ {p.rating.toFixed(1)} <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>({p.total_ratings} reviews)</span>
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{p.address}</div>
                  {dist != null && (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>📍 {dist.toFixed(1)} mi · ~{eta} min drive</div>
                  )}
                  {/* Action buttons */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 12px', background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', borderRadius: 10, textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>
                      🗺 Directions
                    </a>
                    <LazyCardButtons placeId={p.place_id} />
                    <button onClick={() => setClaimPlace(p)} style={{ padding: '8px 12px', background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.4)', color: '#a5b4fc', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      🏷 Claim
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {claimPlace && <ClaimModal place={claimPlace} onClose={() => setClaimPlace(null)} />}
    </div>
  )
}

/* ─── Lazy Card Buttons (phone + website) ────────────────────────── */
function LazyCardButtons({ placeId }: { placeId: string }) {
  const [details, setDetails] = useState<{ phone?: string; website?: string } | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/places/details?place_id=${placeId}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setDetails(d); setLoaded(true) } })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [placeId])

  if (!loaded) return null
  return (
    <>
      {details?.phone && (
        <a href={`tel:${details.phone}`} style={{ padding: '8px 12px', background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.35)', color: '#6ee7b7', borderRadius: 10, textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>
          📞 Call
        </a>
      )}
      {details?.website && (
        <a href={details.website} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 12px', background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.35)', color: '#93c5fd', borderRadius: 10, textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>
          🌐 Website
        </a>
      )}
    </>
  )
}
