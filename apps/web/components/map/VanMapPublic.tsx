// @ts-nocheck
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '../../lib/supabase/client'

const DISC_EMOJI_MAP: Record<string, string> = {
  fast_food: '🍔', cafe: '☕', ice_cream: '🍦', food_court: '🥙',
  marketplace: '🥙', bakery: '🥙', deli: '🥙', confectionery: '🍦',
  mobile_food: '🍔', mobile_food_vendor: '🍔',
}

function getDiscEmoji(type: string): string {
  return DISC_EMOJI_MAP[type] ?? '🥙'
}

interface Props {
  height?: string
  vanId?: string
}

const DEMO_VANS = [
  { id: 'demo-1', name: "Smith's Fish & Chips", emoji: '🐟', color: '#3b82f6', lat: 53.4808, lng: -2.2426, van_type: 'fish_and_chips', phone: '+441612345678', slug: 'smiths-fish-chips' },
  { id: 'demo-2', name: 'Blue Sky Burgers',     emoji: '🍔', color: '#f97316', lat: 53.4750, lng: -2.2350, van_type: 'burger',          phone: '+441619876543', slug: 'blue-sky-burgers' },
  { id: 'demo-3', name: 'Bella Italia Street',  emoji: '🍕', color: '#ef4444', lat: 53.4870, lng: -2.2500, van_type: 'pizza',           phone: '+441611112222', slug: 'bella-italia-street' },
]

const EMOJI_MAP: Record<string, string> = {
  fish_and_chips:'🐟', burger:'🍔', pizza:'🍕', coffee:'☕',
  ice_cream:'🍦', dessert:'🍰', street_food:'🥙', catering_trailer:'🚐',
}
const COLOR_MAP: Record<string, string> = {
  fish_and_chips:'#3b82f6', burger:'#f97316', pizza:'#ef4444', coffee:'#d97706',
  ice_cream:'#8b5cf6', dessert:'#ec4899', street_food:'#10b981', catering_trailer:'#6366f1',
}

// Haversine distance in km
function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

function formatTime(km: number) {
  // ~25 km/h average city speed on foot/car
  const walkMins = Math.round((km / 5) * 60)   // 5 km/h walking
  const driveMins = Math.round((km / 25) * 60)  // 25 km/h driving
  if (km < 0.5) return `${walkMins} min walk`
  return `${driveMins} min drive`
}

// Global navigate function — called from popup button onclick
// Gets fresh GPS on every tap, never uses a cached position
if (typeof window !== 'undefined') {
  (window as any).__ftNavigate = (vanLat: number, vanLng: number, btnId: string) => {
    const btn = document.getElementById(btnId)
    if (btn) {
      btn.textContent = '📍 Finding your location…'
      btn.style.opacity = '0.75'
      btn.style.pointerEvents = 'none'
    }

    const openMaps = (originLat?: number, originLng?: number) => {
      const dest = `${vanLat},${vanLng}`
      const url = originLat != null && originLng != null
        ? `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${dest}&travelmode=driving`
        : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`
      window.open(url, '_blank')
      if (btn) {
        btn.textContent = '📍 Navigate from My Location'
        btn.style.opacity = '1'
        btn.style.pointerEvents = 'auto'
      }
    }

    if (!navigator.geolocation) { openMaps(); return }

    navigator.geolocation.getCurrentPosition(
      (pos) => openMaps(pos.coords.latitude, pos.coords.longitude),
      ()    => openMaps(), // permission denied — use destination only
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    )
  }
}

function buildPopupHTML(
  name: string, emoji: string, color: string, vanLat: number, vanLng: number,
  userLat: number | null, userLng: number | null,
  isLive: boolean, slug: string, phone: string, vanId: string
) {
  const km = (userLat !== null && userLng !== null)
    ? haversine(userLat, userLng, vanLat, vanLng)
    : null

  // Unique button id so the global handler can find it
  const btnId = `ft-nav-btn-${vanId}`

  return `
    <div style="
      font-family:-apple-system,BlinkMacSystemFont,sans-serif;
      background:#070b14;
      border-radius:16px;
      width:260px;
      overflow:hidden;
    ">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,${color}22,${color}11);border-bottom:1px solid ${color}33;padding:14px 16px 12px;display:flex;align-items:center;gap:10px">
        <div style="width:40px;height:40px;border-radius:50%;background:${color}22;border:1.5px solid ${color}55;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${emoji}</div>
        <div style="min-width:0">
          <div style="font-size:14px;font-weight:800;color:#fff;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
          <div style="margin-top:4px;display:flex;align-items:center;gap:5px">
            <span style="width:7px;height:7px;border-radius:50%;background:${isLive ? '#4ade80' : '#fbbf24'};display:inline-block;box-shadow:0 0 6px ${isLive ? '#4ade80' : '#fbbf24'}"></span>
            <span style="font-size:11px;font-weight:700;color:${isLive ? '#4ade80' : '#fbbf24'}">${isLive ? 'Live Now' : 'Arriving Soon'}</span>
          </div>
        </div>
      </div>

      <!-- Distance info -->
      ${km !== null ? `
      <div style="padding:10px 16px;display:grid;grid-template-columns:1fr 1fr;gap:8px;border-bottom:1px solid rgba(255,255,255,.06)">
        <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:8px 10px;text-align:center">
          <div style="font-size:10px;color:rgba(255,255,255,.4);font-weight:600;text-transform:uppercase;letter-spacing:.04em">Distance</div>
          <div style="font-size:15px;font-weight:800;color:#fff;margin-top:2px">${formatDistance(km)}</div>
        </div>
        <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:8px 10px;text-align:center">
          <div style="font-size:10px;color:rgba(255,255,255,.4);font-weight:600;text-transform:uppercase;letter-spacing:.04em">ETA</div>
          <div style="font-size:15px;font-weight:800;color:#fff;margin-top:2px">${formatTime(km)}</div>
        </div>
      </div>
      ` : `
      <div style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.06)">
        <div style="font-size:12px;color:rgba(255,255,255,.35);text-align:center">📍 Location permission needed for ETA</div>
      </div>
      `}

      <!-- Buttons -->
      <div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px">

        <!-- Navigate button — calls window.__ftNavigate on click for live GPS -->
        <button id="${btnId}"
          onclick="window.__ftNavigate(${vanLat},${vanLng},'${btnId}')"
          style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 16px;border-radius:10px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;font-size:13px;font-weight:800;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(249,115,22,.4);letter-spacing:-.01em;width:100%">
          📍 Navigate from My Location
        </button>

        <!-- Call + Menu row -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${phone ? `
          <a href="tel:${phone}"
            style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 8px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.85);font-size:12px;font-weight:700;text-decoration:none">
            📞 Call Van
          </a>
          ` : `
          <div style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 8px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);color:rgba(255,255,255,.25);font-size:12px;font-weight:700">
            📞 Call Van
          </div>
          `}
          <a href="/van/${slug}"
            style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 8px;border-radius:10px;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.25);color:#fbbf24;font-size:12px;font-weight:700;text-decoration:none">
            🍟 View Menu
          </a>
        </div>

      </div>
    </div>
  `
}

function makeDiscoveredIcon(L: any, emoji: string) {
  return L.divIcon({
    html: `
      <div style="position:relative;width:36px;height:36px">
        <div style="position:absolute;inset:3px;border-radius:50%;background:#374151;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 8px rgba(0,0,0,.6),0 0 0 2px rgba(255,255,255,.15)">${emoji}</div>
      </div>
    `,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -22],
  })
}

// Global invite handler — called from discovered popup button
if (typeof window !== 'undefined') {
  (window as any).__ftInvite = async (
    btnId: string, name: string, address: string,
    lat: number, lng: number, phone: string, website: string,
    businessType: string, osmId: string
  ) => {
    const btn = document.getElementById(btnId)
    if (!btn) return
    btn.textContent = '⏳ Saving…'
    btn.style.opacity = '0.75'
    btn.style.pointerEvents = 'none'
    try {
      await fetch('/api/discovery/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, address, lat, lng, phone, website, business_type: businessType, source: 'overpass', osm_id: osmId }),
      })
      btn.textContent = '✅ Invited!'
      btn.style.background = 'rgba(16,185,129,.15)'
      btn.style.borderColor = 'rgba(16,185,129,.3)'
      btn.style.color = '#34d399'
    } catch {
      btn.textContent = '✉️ Invite to FoodTaxi'
      btn.style.opacity = '1'
      btn.style.pointerEvents = 'auto'
    }
  }
}

function buildDiscoveredPopupHTML(
  biz: any, userLat: number | null, userLng: number | null
) {
  const emoji = getDiscEmoji(biz.business_type)
  const km = (userLat !== null && userLng !== null)
    ? haversine(userLat, userLng, biz.lat, biz.lng)
    : null
  const navBtnId = `ft-nav-disc-${biz.id}`
  const invBtnId = `ft-inv-disc-${biz.id}`

  const osmId = biz.id.startsWith('osm_') ? biz.id : ''
  const safeEscape = (s: string) => (s ?? '').replace(/'/g, "\\'").replace(/"/g, '&quot;')

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#070b14;border-radius:16px;width:260px;overflow:hidden;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,rgba(107,114,128,.15),rgba(107,114,128,.08));border-bottom:1px solid rgba(107,114,128,.2);padding:14px 16px 12px;display:flex;align-items:center;gap:10px">
        <div style="width:40px;height:40px;border-radius:50%;background:rgba(107,114,128,.2);border:1.5px solid rgba(107,114,128,.4);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${emoji}</div>
        <div style="min-width:0">
          <div style="font-size:14px;font-weight:800;color:#fff;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safeEscape(biz.name)}</div>
          <div style="margin-top:4px">
            <span style="font-size:10px;font-weight:700;color:#9ca3af;background:rgba(107,114,128,.2);padding:2px 7px;border-radius:20px;border:1px solid rgba(107,114,128,.3)">Not Yet On FoodTaxi</span>
          </div>
        </div>
      </div>

      <!-- Address -->
      ${biz.address ? `
      <div style="padding:8px 16px;border-bottom:1px solid rgba(255,255,255,.06)">
        <div style="font-size:12px;color:rgba(255,255,255,.45)">📍 ${safeEscape(biz.address)}</div>
      </div>` : ''}

      <!-- Distance & ETA -->
      ${km !== null ? `
      <div style="padding:10px 16px;display:grid;grid-template-columns:1fr 1fr;gap:8px;border-bottom:1px solid rgba(255,255,255,.06)">
        <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:8px 10px;text-align:center">
          <div style="font-size:10px;color:rgba(255,255,255,.4);font-weight:600;text-transform:uppercase;letter-spacing:.04em">Distance</div>
          <div style="font-size:15px;font-weight:800;color:#fff;margin-top:2px">${formatDistance(km)}</div>
        </div>
        <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:8px 10px;text-align:center">
          <div style="font-size:10px;color:rgba(255,255,255,.4);font-weight:600;text-transform:uppercase;letter-spacing:.04em">ETA</div>
          <div style="font-size:15px;font-weight:800;color:#fff;margin-top:2px">${formatTime(km)}</div>
        </div>
      </div>
      ` : `
      <div style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.06)">
        <div style="font-size:12px;color:rgba(255,255,255,.35);text-align:center">📍 Location permission needed for ETA</div>
      </div>
      `}

      <!-- Buttons -->
      <div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px">
        <button id="${navBtnId}"
          onclick="window.__ftNavigate(${biz.lat},${biz.lng},'${navBtnId}')"
          style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 16px;border-radius:10px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;font-size:13px;font-weight:800;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(249,115,22,.4);width:100%">
          📍 Get Directions
        </button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${biz.phone ? `
          <a href="tel:${safeEscape(biz.phone)}"
            style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 8px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.85);font-size:12px;font-weight:700;text-decoration:none">
            📞 Call
          </a>` : `
          <div style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 8px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);color:rgba(255,255,255,.25);font-size:12px;font-weight:700">
            📞 Call
          </div>`}
          <button id="${invBtnId}"
            onclick="window.__ftInvite('${invBtnId}','${safeEscape(biz.name)}','${safeEscape(biz.address ?? '')}',${biz.lat},${biz.lng},'${safeEscape(biz.phone ?? '')}','${safeEscape(biz.website ?? '')}','${safeEscape(biz.business_type ?? '')}','${osmId}')"
            style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 8px;border-radius:10px;background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.3);color:#a5b4fc;font-size:12px;font-weight:700;cursor:pointer;border:1px solid rgba(99,102,241,.3)">
            ✉️ Invite
          </button>
        </div>
      </div>
    </div>
  `
}

function makeVanIcon(L: any, emoji: string, color: string) {
  return L.divIcon({
    html: `
      <div style="position:relative;width:48px;height:48px">
        <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:.2;animation:vanPulse 2s ease-out infinite"></div>
        <div style="position:absolute;inset:5px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:19px;box-shadow:0 2px 12px rgba(0,0,0,.6),0 0 0 2px rgba(255,255,255,.25)">${emoji}</div>
      </div>
    `,
    className: '',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -28],
  })
}

export function VanMapPublic({ height = '480px', vanId }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null)
  const [vanCount, setVanCount] = useState(0)
  const [isDemo, setIsDemo] = useState(false)
  const [findingNearest, setFindingNearest] = useState(false)
  const [locationStatus, setLocationStatus] = useState<'waiting'|'granted'|'denied'|'done'>('waiting')
  const demoIntervalRef = useRef<any>(null)
  const discoveryMarkersRef = useRef<any[]>([])
  const leafletRef = useRef<any>(null)

  // Fetch and render discovered nearby businesses at given coords
  const loadDiscoveredBusinessesAt = useCallback((L: any, lat: number, lng: number) => {
    discoveryMarkersRef.current.forEach(m => { try { m.remove() } catch {} })
    discoveryMarkersRef.current = []
    fetch(`/api/discovery/nearby?lat=${lat}&lng=${lng}`)
      .then(r => r.json())
      .then(({ discovered }) => {
        if (!discovered || !mapRef.current) return
        discovered.forEach((biz: any) => {
          const icon = makeDiscoveredIcon(L, getDiscEmoji(biz.business_type))
          const marker = L.marker([biz.lat, biz.lng], { icon }).addTo(mapRef.current)
          marker.on('click', () => {
            const ul = userLocationRef.current
            const html = buildDiscoveredPopupHTML(biz, ul?.lat ?? null, ul?.lng ?? null)
            marker.bindPopup(html, { maxWidth: 280, minWidth: 260, className: 'ft-van-popup' }).openPopup()
          })
          discoveryMarkersRef.current.push(marker)
        })
      })
      .catch(() => {})
  }, [])

  // Add "You are here" blue dot
  const addUserDot = useCallback((L: any, lat: number, lng: number) => {
    L.circleMarker([lat, lng], {
      radius: 8, fillColor: '#60a5fa', color: '#fff', weight: 2, fillOpacity: 0.9,
    }).addTo(mapRef.current).bindTooltip('You are here', { permanent: false, direction: 'top' })
  }, [])

  // Get GPS — allows cached position (up to 60s) so it resolves instantly if already granted
  const getUserLocation = useCallback((): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return }
      // Try cached position first (fast)
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
      )
    })
  }, [])

  const buildMarker = useCallback((L: any, id: string, name: string, emoji: string, color: string,
    lat: number, lng: number, isLive: boolean, slug: string, phone: string) => {
    const marker = L.marker([lat, lng], { icon: makeVanIcon(L, emoji, color) })
      .addTo(mapRef.current)

    const openPopup = () => {
      const ul = userLocationRef.current
      const html = buildPopupHTML(name, emoji, color, lat, lng, ul?.lat ?? null, ul?.lng ?? null, isLive, slug, phone, id)
      marker.bindPopup(html, {
        maxWidth: 280,
        minWidth: 260,
        className: 'ft-van-popup',
      }).openPopup()
    }

    marker.on('click', openPopup)
    markersRef.current.set(id, { marker, lat, lng, name, emoji, color, isLive, slug, phone })
    return marker
  }, [])

  // Place demo vans around a given centre (user's real GPS or fallback)
  const startDemoMovement = useCallback((L: any, centreLat: number, centreLng: number) => {
    setIsDemo(true)
    // Spread demo vans within ~500m of centre
    const offsets = [
      [0.003, 0.004], [-0.004, 0.002], [0.002, -0.005],
    ]
    DEMO_VANS.forEach((van, i) => {
      const lat = centreLat + offsets[i][0]
      const lng = centreLng + offsets[i][1]
      buildMarker(L, van.id, van.name, van.emoji, van.color, lat, lng, true, van.slug, van.phone)
    })
    setVanCount(DEMO_VANS.length)

    demoIntervalRef.current = setInterval(() => {
      markersRef.current.forEach((data, id) => {
        const newLat = data.lat + (Math.random() - 0.5) * 0.0018
        const newLng = data.lng + (Math.random() - 0.5) * 0.0018
        data.marker.setLatLng([newLat, newLng])
        data.lat = newLat
        data.lng = newLng
        markersRef.current.set(id, data)
      })
    }, 2500)
  }, [buildMarker])

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return

    let supabaseChannel: any = null

    const setup = async () => {
      const L = (await import('leaflet')).default

      // Leaflet CSS
      if (!document.querySelector('#leaflet-css')) {
        const link = document.createElement('link')
        link.id = 'leaflet-css'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      // Init map
      const map = L.map(mapContainerRef.current!, {
        center: [53.4808, -2.2426],
        zoom: 13,
        zoomControl: true,
        attributionControl: false,
      })
      mapRef.current = map
      leafletRef.current = L

      // Dark tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, subdomains: 'abcd',
      }).addTo(map)

      L.control.attribution({ position: 'bottomright', prefix: false })
        .addAttribution('© <a href="https://carto.com" style="color:#555">CARTO</a>')
        .addTo(map)

      // Get user GPS first — everything centres around them
      const userLoc = await getUserLocation()
      const FALLBACK = { lat: 53.4808, lng: -2.2426 }
      const centre = userLoc ?? FALLBACK

      userLocationRef.current = userLoc
      setLocationStatus(userLoc ? 'granted' : 'denied')

      // Centre map on user (or fallback)
      map.setView([centre.lat, centre.lng], 14)

      // Add blue "You are here" dot
      if (userLoc) addUserDot(L, userLoc.lat, userLoc.lng)

      // Load nearby discovered businesses around user
      loadDiscoveredBusinessesAt(L, centre.lat, centre.lng)

      // Fetch live vans
      const supabase = createClient()
      let query = supabase
        .from('live_locations')
        .select('*, vans!inner(id, name, van_type, tracking_status, slug, phone)')
        .eq('vans.tracking_status', 'live')
      if (vanId) query = (query as any).eq('van_id', vanId)

      const { data: liveData } = await (query as any)
        .order('recorded_at', { ascending: false })
        .limit(50)

      if (liveData && liveData.length > 0) {
        liveData.forEach((loc: any) => {
          const van = loc.vans
          const emoji = EMOJI_MAP[van.van_type] ?? '🚐'
          const color = COLOR_MAP[van.van_type] ?? '#f97316'
          buildMarker(L, van.id, van.name, emoji, color, loc.latitude, loc.longitude, true, van.slug ?? van.id, van.phone ?? '')
        })
        setVanCount(liveData.length)
      } else {
        // Demo vans spawn near user's actual location
        startDemoMovement(L, centre.lat, centre.lng)
      }

      // Real-time position updates
      supabaseChannel = supabase
        .channel('van-live-map')
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'live_locations',
          ...(vanId ? { filter: `van_id=eq.${vanId}` } : {}),
        }, (payload) => {
          const { van_id, latitude, longitude } = payload.new as any
          const existing = markersRef.current.get(van_id)
          if (existing) {
            existing.marker.setLatLng([latitude, longitude])
            existing.lat = latitude
            existing.lng = longitude
            markersRef.current.set(van_id, existing)
          }
          setVanCount(markersRef.current.size)
        })
        .subscribe()
    }

    setup()

    return () => {
      if (supabaseChannel) createClient().removeChannel(supabaseChannel)
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current)
      discoveryMarkersRef.current.forEach(m => { try { m.remove() } catch {} })
      discoveryMarkersRef.current = []
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
      markersRef.current.clear()
    }
  }, [vanId, getUserLocation, addUserDot, buildMarker, startDemoMovement, loadDiscoveredBusinessesAt])

  return (
    <div style={{ position: 'relative', height, borderRadius: 24, overflow: 'hidden', background: '#0d1117' }}>
      <style>{`
        @keyframes vanPulse {
          0%   { transform:scale(1);   opacity:.2 }
          100% { transform:scale(2.8); opacity:0  }
        }
        .ft-van-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          border: none !important;
          border-radius: 16px !important;
          padding: 0 !important;
          box-shadow: 0 20px 60px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,.08) !important;
          overflow: hidden;
        }
        .ft-van-popup .leaflet-popup-content { margin: 0 !important; }
        .ft-van-popup .leaflet-popup-tip-container { display: none }
        .ft-van-popup .leaflet-popup-close-button {
          color: rgba(255,255,255,.4) !important;
          font-size: 18px !important;
          top: 8px !important;
          right: 10px !important;
          z-index: 10;
        }
        .leaflet-control-zoom a {
          background: rgba(7,11,20,.9) !important;
          color: #fff !important;
          border-color: rgba(255,255,255,.12) !important;
          backdrop-filter: blur(8px);
        }
        .leaflet-control-zoom a:hover { background: rgba(255,255,255,.1) !important }
        .leaflet-bar { border: 1px solid rgba(255,255,255,.12) !important; box-shadow: 0 4px 14px rgba(0,0,0,.4) !important }
      `}</style>

      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Find Nearest Van button */}
      <button
        onClick={() => {
          if (!navigator.geolocation || !mapRef.current) return
          setFindingNearest(true)
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude: uLat, longitude: uLng } = pos.coords
              userLocationRef.current = { lat: uLat, lng: uLng }
              let nearest: any = null
              let minDist = Infinity
              markersRef.current.forEach((data) => {
                const d = haversine(uLat, uLng, data.lat, data.lng)
                if (d < minDist) { minDist = d; nearest = data }
              })
              setFindingNearest(false)
              if (nearest) {
                mapRef.current.flyTo([nearest.lat, nearest.lng], 16, { duration: 1.4 })
                setTimeout(() => nearest.marker.fire('click'), 1500)
              }
            },
            () => setFindingNearest(false),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
          )
        }}
        style={{ position:'absolute', top:14, right:14, zIndex:1000, background: findingNearest ? 'rgba(251,191,36,.3)' : 'linear-gradient(135deg,#fbbf24,#f59e0b)', color:'#0a0a14', border:'none', borderRadius:10, padding:'9px 16px', fontWeight:800, fontSize:13, cursor: findingNearest ? 'wait' : 'pointer', display:'flex', alignItems:'center', gap:7, boxShadow:'0 4px 14px rgba(251,191,36,.35)', backdropFilter:'blur(8px)' }}
      >
        {findingNearest ? '📍 Finding…' : '📍 Find Nearest Van'}
      </button>

      {/* Status badge */}
      <div style={{ position:'absolute', top:14, left:14, zIndex:1000, background:'rgba(6,9,20,.85)', backdropFilter:'blur(10px)', borderRadius:10, padding:'8px 14px', display:'flex', alignItems:'center', gap:8, border:'1px solid rgba(255,255,255,.1)' }}>
        <span style={{ width:8, height:8, borderRadius:'50%', background:'#4ade80', display:'inline-block', boxShadow:'0 0 6px #4ade80' }} />
        <span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>
          {vanCount > 0 ? `${vanCount} van${vanCount > 1 ? 's' : ''} live` : 'Loading…'}
        </span>
        {isDemo && (
          <span style={{ fontSize:10, color:'#fbbf24', fontWeight:600, background:'rgba(251,191,36,.15)', padding:'2px 6px', borderRadius:6 }}>DEMO</span>
        )}
      </div>

      {/* Map legend — bottom right */}
      <div style={{ position:'absolute', bottom:50, right:14, zIndex:1000, background:'rgba(6,9,20,.88)', backdropFilter:'blur(10px)', borderRadius:12, padding:'10px 14px', border:'1px solid rgba(255,255,255,.08)', display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ width:12, height:12, borderRadius:'50%', background:'#f97316', display:'inline-block', boxShadow:'0 0 6px #f97316' }} />
          <span style={{ fontSize:11, color:'rgba(255,255,255,.6)', fontWeight:600 }}>FoodTaxi Van (Live)</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ width:12, height:12, borderRadius:'50%', background:'#6b7280', display:'inline-block' }} />
          <span style={{ fontSize:11, color:'rgba(255,255,255,.6)', fontWeight:600 }}>Local Food Business</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ width:12, height:12, borderRadius:'50%', background:'#60a5fa', display:'inline-block' }} />
          <span style={{ fontSize:11, color:'rgba(255,255,255,.6)', fontWeight:600 }}>You Are Here</span>
        </div>
      </div>

      {/* Location denied banner — shows manual centre button */}
      {locationStatus === 'denied' && (
        <div style={{ position:'absolute', bottom:50, left:'50%', transform:'translateX(-50%)', zIndex:1100, background:'rgba(239,68,68,.15)', backdropFilter:'blur(12px)', border:'1px solid rgba(239,68,68,.35)', borderRadius:14, padding:'10px 16px', display:'flex', alignItems:'center', gap:10, whiteSpace:'nowrap' }}>
          <span style={{ fontSize:13, color:'#fca5a5', fontWeight:600 }}>📍 Location not shared</span>
          <button
            onClick={() => {
              if (!navigator.geolocation) return
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const { latitude: lat, longitude: lng } = pos.coords
                  userLocationRef.current = { lat, lng }
                  setLocationStatus('granted')
                  if (mapRef.current) mapRef.current.flyTo([lat, lng], 15, { duration: 1.2 })
                  if (leafletRef.current) {
                    addUserDot(leafletRef.current, lat, lng)
                    loadDiscoveredBusinessesAt(leafletRef.current, lat, lng)
                    // Reposition demo vans near user
                    if (isDemo) {
                      markersRef.current.forEach((data, id) => {
                        const offsets: Record<string, number[]> = { 'demo-1': [0.003,0.004], 'demo-2': [-0.004,0.002], 'demo-3': [0.002,-0.005] }
                        const off = offsets[id] ?? [0,0]
                        const newLat = lat + off[0]; const newLng = lng + off[1]
                        data.marker.setLatLng([newLat, newLng])
                        data.lat = newLat; data.lng = newLng
                        markersRef.current.set(id, data)
                      })
                    }
                  }
                },
                () => {},
                { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
              )
            }}
            style={{ background:'rgba(239,68,68,.25)', border:'1px solid rgba(239,68,68,.4)', borderRadius:8, padding:'5px 12px', color:'#fca5a5', fontSize:12, fontWeight:700, cursor:'pointer' }}
          >
            Allow & Centre
          </button>
        </div>
      )}

      {/* Tap hint */}
      <div style={{ position:'absolute', bottom:14, left:'50%', transform:'translateX(-50%)', zIndex:1000, background:'rgba(6,9,20,.8)', backdropFilter:'blur(8px)', borderRadius:20, padding:'6px 14px', border:'1px solid rgba(255,255,255,.08)', whiteSpace:'nowrap' }}>
        <span style={{ fontSize:11, color:'rgba(255,255,255,.5)', fontWeight:600 }}>👆 Tap a van to navigate</span>
      </div>
    </div>
  )
}
