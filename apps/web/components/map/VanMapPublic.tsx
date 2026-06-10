// @ts-nocheck
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface Props {
  height?: string
  vanId?: string
  centerLat?: number
  centerLng?: number
  searchLabel?: string
}

const EMOJI_MAP: Record<string, string> = {
  fish_and_chips:'🐟', burger:'🍔', pizza:'🍕', coffee:'☕',
  ice_cream:'🍦', dessert:'🍰', street_food:'🥙', catering_trailer:'🚐',
  fast_food:'🍔', cafe:'☕', restaurant:'🍽️', bakery:'🥐',
  deli:'🥪', food_court:'🥙', pub:'🍺', bar:'🍺',
  mobile_food_vendor:'🚐', food_business:'🍽️',
}

function getEmoji(type: string) { return EMOJI_MAP[type] ?? '🍽️' }

const VAN_COLORS: Record<string, string> = {
  fish_and_chips:'#3b82f6', burger:'#f97316', pizza:'#ef4444', coffee:'#d97706',
  ice_cream:'#8b5cf6', dessert:'#ec4899', street_food:'#10b981', catering_trailer:'#6366f1',
}
function getColor(type: string) { return VAN_COLORS[type] ?? '#f97316' }

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function fmtDist(km: number) { return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km` }
function fmtEta(km: number) {
  const m = Math.round((km / 25) * 60)
  return km < 0.5 ? `${Math.round((km / 5) * 60)} min walk` : `${m} min drive`
}

// ── Global navigate handler ──────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  (window as any).__ftNavigate = (destLat: number, destLng: number, btnId: string) => {
    const btn = document.getElementById(btnId)
    if (btn) { btn.textContent = '📍 Finding you…'; btn.style.opacity = '0.7'; btn.style.pointerEvents = 'none' }
    const open = (oLat?: number, oLng?: number) => {
      const dest = `${destLat},${destLng}`
      const url = oLat != null
        ? `https://www.google.com/maps/dir/?api=1&origin=${oLat},${oLng}&destination=${dest}&travelmode=driving`
        : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`
      window.open(url, '_blank')
      if (btn) { btn.textContent = '📍 Navigate'; btn.style.opacity = '1'; btn.style.pointerEvents = 'auto' }
    }
    if (!navigator.geolocation) { open(); return }
    navigator.geolocation.getCurrentPosition(
      p => open(p.coords.latitude, p.coords.longitude),
      () => open(),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    )
  }

  ;(window as any).__ftInvite = async (btnId: string, name: string, address: string, lat: number, lng: number, phone: string, website: string, type: string, osmId: string) => {
    const btn = document.getElementById(btnId)
    if (!btn) return
    btn.textContent = '⏳ Saving…'; btn.style.opacity = '0.75'; btn.style.pointerEvents = 'none'
    try {
      await fetch('/api/discovery/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, address, lat, lng, phone, website, business_type: type, source: 'overpass', osm_id: osmId }),
      })
      btn.textContent = '✅ Invited!'; btn.style.background = 'rgba(16,185,129,.15)'; btn.style.color = '#34d399'
    } catch {
      btn.textContent = '✉️ Invite'; btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'
    }
  }
}

// ── Popup builders ───────────────────────────────────────────────────────────
function liveVanPopup(v: any, uLat: number|null, uLng: number|null) {
  const km = uLat != null ? haversine(uLat, uLng!, v.latitude, v.longitude) : null
  const btnId = `ft-nav-${v.vans?.id ?? v.id}`
  const color = getColor(v.vans?.van_type ?? '')
  const emoji = getEmoji(v.vans?.van_type ?? '')
  return `<div style="font-family:-apple-system,sans-serif;background:#070b14;border-radius:16px;width:260px;overflow:hidden">
    <div style="background:linear-gradient(135deg,${color}22,${color}11);border-bottom:1px solid ${color}33;padding:14px 16px 12px;display:flex;align-items:center;gap:10px">
      <div style="width:40px;height:40px;border-radius:50%;background:${color}22;border:1.5px solid ${color}55;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${emoji}</div>
      <div>
        <div style="font-size:14px;font-weight:800;color:#fff">${v.vans?.name ?? 'Food Van'}</div>
        <div style="margin-top:3px;display:flex;align-items:center;gap:5px">
          <span style="width:7px;height:7px;border-radius:50%;background:#4ade80;display:inline-block;box-shadow:0 0 6px #4ade80"></span>
          <span style="font-size:11px;font-weight:700;color:#4ade80">Live Now</span>
          <span style="font-size:10px;background:rgba(74,222,128,.15);color:#4ade80;padding:1px 6px;border-radius:10px;font-weight:700">FoodTaxi</span>
        </div>
      </div>
    </div>
    ${km != null ? `<div style="padding:10px 16px;display:grid;grid-template-columns:1fr 1fr;gap:8px;border-bottom:1px solid rgba(255,255,255,.06)">
      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:8px 10px;text-align:center">
        <div style="font-size:10px;color:rgba(255,255,255,.4);font-weight:600;text-transform:uppercase">Distance</div>
        <div style="font-size:15px;font-weight:800;color:#fff;margin-top:2px">${fmtDist(km)}</div>
      </div>
      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:8px 10px;text-align:center">
        <div style="font-size:10px;color:rgba(255,255,255,.4);font-weight:600;text-transform:uppercase">ETA</div>
        <div style="font-size:15px;font-weight:800;color:#fff;margin-top:2px">${fmtEta(km)}</div>
      </div>
    </div>` : ''}
    <div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px">
      <button id="${btnId}" onclick="window.__ftNavigate(${v.latitude},${v.longitude},'${btnId}')"
        style="padding:12px;border-radius:10px;background:linear-gradient(135deg,#4ade80,#16a34a);color:#fff;font-size:13px;font-weight:800;border:none;cursor:pointer;width:100%">
        📍 Navigate to Van
      </button>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${v.vans?.phone ? `<a href="tel:${v.vans.phone}" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 8px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.85);font-size:12px;font-weight:700;text-decoration:none">📞 Call</a>` :
          `<div style="padding:10px 8px;border-radius:10px;background:rgba(255,255,255,.03);color:rgba(255,255,255,.2);font-size:12px;font-weight:700;text-align:center">📞 Call</div>`}
        <a href="/van/${v.vans?.slug ?? ''}" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 8px;border-radius:10px;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.25);color:#fbbf24;font-size:12px;font-weight:700;text-decoration:none">🍟 Menu</a>
      </div>
    </div>
  </div>`
}

function registeredBizPopup(b: any, uLat: number|null, uLng: number|null) {
  const km = uLat != null ? haversine(uLat, uLng!, b.latitude, b.longitude) : null
  const btnId = `ft-nav-biz-${b.id}`
  const color = getColor(b.van_type ?? '')
  const emoji = getEmoji(b.van_type ?? '')
  return `<div style="font-family:-apple-system,sans-serif;background:#070b14;border-radius:16px;width:260px;overflow:hidden">
    <div style="background:linear-gradient(135deg,${color}22,${color}11);border-bottom:1px solid ${color}33;padding:14px 16px 12px;display:flex;align-items:center;gap:10px">
      <div style="width:40px;height:40px;border-radius:50%;background:${color}22;border:1.5px solid ${color}55;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${emoji}</div>
      <div>
        <div style="font-size:14px;font-weight:800;color:#fff">${b.name}</div>
        <div style="margin-top:3px;display:flex;align-items:center;gap:5px">
          <span style="font-size:10px;background:rgba(249,115,22,.2);color:#fb923c;padding:1px 6px;border-radius:10px;font-weight:700">FoodTaxi Business</span>
        </div>
      </div>
    </div>
    ${km != null ? `<div style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.06)">
      <div style="font-size:13px;color:rgba(255,255,255,.6);text-align:center">📍 ${fmtDist(km)} away · ${fmtEta(km)}</div>
    </div>` : ''}
    ${b.address ? `<div style="padding:8px 16px;border-bottom:1px solid rgba(255,255,255,.06)"><div style="font-size:12px;color:rgba(255,255,255,.45)">📍 ${b.address}</div></div>` : ''}
    <div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px">
      <button id="${btnId}" onclick="window.__ftNavigate(${b.latitude},${b.longitude},'${btnId}')"
        style="padding:12px;border-radius:10px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;font-size:13px;font-weight:800;border:none;cursor:pointer;width:100%">
        📍 Navigate
      </button>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${b.phone ? `<a href="tel:${b.phone}" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 8px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.85);font-size:12px;font-weight:700;text-decoration:none">📞 Call</a>` :
          `<div style="padding:10px 8px;border-radius:10px;background:rgba(255,255,255,.03);color:rgba(255,255,255,.2);font-size:12px;font-weight:700;text-align:center">📞 Call</div>`}
        ${b.slug ? `<a href="/van/${b.slug}" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 8px;border-radius:10px;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.25);color:#fbbf24;font-size:12px;font-weight:700;text-decoration:none">🍟 Menu</a>` :
          `<div style="padding:10px 8px;border-radius:10px;background:rgba(255,255,255,.03);color:rgba(255,255,255,.2);font-size:12px;font-weight:700;text-align:center">No menu yet</div>`}
      </div>
    </div>
  </div>`
}

function localBizPopup(b: any, uLat: number|null, uLng: number|null, source: 'imported'|'discovered') {
  const bLat = b.latitude ?? b.lat
  const bLng = b.longitude ?? b.lng
  const km = uLat != null ? haversine(uLat, uLng!, bLat, bLng) : null
  const navBtnId = `ft-nav-local-${b.id}`
  const invBtnId = `ft-inv-local-${b.id}`
  const type = b.food_type ?? b.business_type ?? 'food_business'
  const emoji = getEmoji(type)
  const safe = (s: string) => (s ?? '').replace(/'/g, "\\'").replace(/"/g, '&quot;')
  const osmId = b.osm_id ?? ''
  return `<div style="font-family:-apple-system,sans-serif;background:#070b14;border-radius:16px;width:260px;overflow:hidden">
    <div style="background:linear-gradient(135deg,rgba(107,114,128,.15),rgba(107,114,128,.08));border-bottom:1px solid rgba(107,114,128,.2);padding:14px 16px 12px;display:flex;align-items:center;gap:10px">
      <div style="width:40px;height:40px;border-radius:50%;background:rgba(107,114,128,.2);border:1.5px solid rgba(107,114,128,.4);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${emoji}</div>
      <div style="min-width:0">
        <div style="font-size:14px;font-weight:800;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${safe(b.name)}</div>
        <div style="margin-top:3px">
          <span style="font-size:10px;color:#9ca3af;background:rgba(107,114,128,.2);padding:2px 7px;border-radius:20px;border:1px solid rgba(107,114,128,.3)">Not Yet On FoodTaxi</span>
        </div>
      </div>
    </div>
    ${b.address ? `<div style="padding:8px 16px;border-bottom:1px solid rgba(255,255,255,.06)"><div style="font-size:12px;color:rgba(255,255,255,.45)">📍 ${safe(b.address)}</div></div>` : ''}
    ${km != null ? `<div style="padding:10px 16px;display:grid;grid-template-columns:1fr 1fr;gap:8px;border-bottom:1px solid rgba(255,255,255,.06)">
      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:8px 10px;text-align:center">
        <div style="font-size:10px;color:rgba(255,255,255,.4);font-weight:600;text-transform:uppercase">Distance</div>
        <div style="font-size:15px;font-weight:800;color:#fff;margin-top:2px">${fmtDist(km)}</div>
      </div>
      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:8px 10px;text-align:center">
        <div style="font-size:10px;color:rgba(255,255,255,.4);font-weight:600;text-transform:uppercase">ETA</div>
        <div style="font-size:15px;font-weight:800;color:#fff;margin-top:2px">${fmtEta(km)}</div>
      </div>
    </div>` : ''}
    <div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px">
      <button id="${navBtnId}" onclick="window.__ftNavigate(${bLat},${bLng},'${navBtnId}')"
        style="padding:12px;border-radius:10px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;font-size:13px;font-weight:800;border:none;cursor:pointer;width:100%">
        📍 Get Directions
      </button>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${b.phone ? `<a href="tel:${safe(b.phone)}" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 8px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.85);font-size:12px;font-weight:700;text-decoration:none">📞 Call</a>` :
          `<div style="padding:10px 8px;border-radius:10px;background:rgba(255,255,255,.03);color:rgba(255,255,255,.2);font-size:12px;font-weight:700;text-align:center">📞 No phone</div>`}
        <button id="${invBtnId}"
          onclick="window.__ftInvite('${invBtnId}','${safe(b.name)}','${safe(b.address??'')}',${bLat},${bLng},'${safe(b.phone??'')}','${safe(b.website??'')}','${safe(type)}','${osmId}')"
          style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 8px;border-radius:10px;background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.3);color:#a5b4fc;font-size:12px;font-weight:700;cursor:pointer">
          ✉️ Invite
        </button>
      </div>
    </div>
  </div>`
}

// ── Icon factories ───────────────────────────────────────────────────────────
function makeLiveVanIcon(L: any, emoji: string, color: string) {
  return L.divIcon({
    html: `<div style="position:relative;width:48px;height:48px">
      <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:.2;animation:vanPulse 2s ease-out infinite"></div>
      <div style="position:absolute;inset:5px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:19px;box-shadow:0 2px 12px rgba(0,0,0,.6),0 0 0 2px rgba(255,255,255,.25)">${emoji}</div>
      <div style="position:absolute;bottom:-2px;right:-2px;width:14px;height:14px;border-radius:50%;background:#4ade80;border:2px solid #070b14;box-shadow:0 0 6px #4ade80"></div>
    </div>`,
    className: '', iconSize: [48, 48], iconAnchor: [24, 24], popupAnchor: [0, -28],
  })
}

function makeRegisteredBizIcon(L: any, emoji: string, color: string) {
  return L.divIcon({
    html: `<div style="position:relative;width:42px;height:42px">
      <div style="position:absolute;inset:4px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 2px 10px rgba(0,0,0,.5),0 0 0 2px rgba(255,255,255,.2)">${emoji}</div>
      <div style="position:absolute;bottom:-1px;right:-1px;width:13px;height:13px;border-radius:50%;background:#f97316;border:2px solid #070b14"></div>
    </div>`,
    className: '', iconSize: [42, 42], iconAnchor: [21, 21], popupAnchor: [0, -25],
  })
}

function makeLocalBizIcon(L: any, emoji: string) {
  return L.divIcon({
    html: `<div style="position:relative;width:36px;height:36px">
      <div style="position:absolute;inset:3px;border-radius:50%;background:#374151;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 8px rgba(0,0,0,.6),0 0 0 2px rgba(255,255,255,.15)">${emoji}</div>
    </div>`,
    className: '', iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -22],
  })
}

// ── Main component ───────────────────────────────────────────────────────────
export function VanMapPublic({ height = '480px', vanId, centerLat, centerLng, searchLabel }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef          = useRef<any>(null)
  const leafletRef      = useRef<any>(null)
  const markersRef      = useRef<Map<string, any>>(new Map())
  const userLocRef      = useRef<{ lat: number; lng: number } | null>(null)
  const demoIntervalRef = useRef<any>(null)
  const allMarkersRef   = useRef<any[]>([])

  const [counts, setCounts]   = useState({ live: 0, biz: 0, local: 0 })
  const [loading, setLoading] = useState(true)
  const [findingNearest, setFindingNearest] = useState(false)
  const [locationDenied, setLocationDenied] = useState(false)

  const getUserGPS = useCallback((): Promise<{ lat: number; lng: number } | null> => {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return }
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
      )
    })
  }, [])

  const addUserDot = useCallback((L: any, lat: number, lng: number) => {
    L.circleMarker([lat, lng], {
      radius: 10, fillColor: '#60a5fa', color: '#fff', weight: 2.5, fillOpacity: 0.95,
    }).addTo(mapRef.current)
      .bindTooltip('📍 You are here', { permanent: false, direction: 'top' })
  }, [])

  const loadMapData = useCallback(async (L: any, lat: number, lng: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/map-data?lat=${lat}&lng=${lng}&radius=5`)
      const { live_vans = [], businesses = [], imported = [], discovered = [] } = await res.json()

      const ul = userLocRef.current

      // Clear existing non-user markers
      allMarkersRef.current.forEach(m => { try { m.remove() } catch {} })
      allMarkersRef.current = []
      markersRef.current.clear()
      if (demoIntervalRef.current) { clearInterval(demoIntervalRef.current); demoIntervalRef.current = null }

      // ── Live vans (green) ──────────────────────────────────────────────────
      live_vans.forEach((v: any) => {
        const type = v.vans?.van_type ?? ''
        const icon = makeLiveVanIcon(L, getEmoji(type), getColor(type))
        const m = L.marker([v.latitude, v.longitude], { icon }).addTo(mapRef.current)
        m.on('click', () => {
          const ul2 = userLocRef.current
          m.bindPopup(liveVanPopup(v, ul2?.lat ?? null, ul2?.lng ?? null), { maxWidth: 280, minWidth: 260, className: 'ft-van-popup' }).openPopup()
        })
        const vId = v.vans?.id ?? v.id
        markersRef.current.set(vId, { marker: m, lat: v.latitude, lng: v.longitude })
        allMarkersRef.current.push(m)
      })

      // ── Registered businesses (orange) ────────────────────────────────────
      businesses.forEach((b: any) => {
        const icon = makeRegisteredBizIcon(L, getEmoji(b.van_type ?? ''), getColor(b.van_type ?? ''))
        const m = L.marker([b.latitude, b.longitude], { icon }).addTo(mapRef.current)
        m.on('click', () => {
          const ul2 = userLocRef.current
          m.bindPopup(registeredBizPopup(b, ul2?.lat ?? null, ul2?.lng ?? null), { maxWidth: 280, minWidth: 260, className: 'ft-van-popup' }).openPopup()
        })
        allMarkersRef.current.push(m)
      })

      // ── Imported local businesses (grey) ──────────────────────────────────
      imported.forEach((b: any) => {
        const m = L.marker([b.latitude, b.longitude], { icon: makeLocalBizIcon(L, getEmoji(b.food_type ?? '')) }).addTo(mapRef.current)
        m.on('click', () => {
          const ul2 = userLocRef.current
          m.bindPopup(localBizPopup(b, ul2?.lat ?? null, ul2?.lng ?? null, 'imported'), { maxWidth: 280, minWidth: 260, className: 'ft-van-popup' }).openPopup()
        })
        allMarkersRef.current.push(m)
      })

      // ── Discovered businesses (grey) ──────────────────────────────────────
      discovered.forEach((b: any) => {
        const bLat = b.latitude ?? b.lat; const bLng = b.longitude ?? b.lng
        if (!bLat || !bLng) return
        const m = L.marker([bLat, bLng], { icon: makeLocalBizIcon(L, getEmoji(b.business_type ?? '')) }).addTo(mapRef.current)
        m.on('click', () => {
          const ul2 = userLocRef.current
          m.bindPopup(localBizPopup({ ...b, latitude: bLat, longitude: bLng }, ul2?.lat ?? null, ul2?.lng ?? null, 'discovered'), { maxWidth: 280, minWidth: 260, className: 'ft-van-popup' }).openPopup()
        })
        allMarkersRef.current.push(m)
      })

      setCounts({ live: live_vans.length, biz: businesses.length, local: imported.length + discovered.length })

      // ── Fallback: if nothing from Supabase, query Overpass directly ────────
      if (live_vans.length === 0 && businesses.length === 0 && imported.length === 0 && discovered.length === 0) {
        loadOverpassFallback(L, lat, lng)
      }
    } catch {
      loadOverpassFallback(L, lat, lng)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadOverpassFallback = useCallback((L: any, lat: number, lng: number) => {
    const query = `[out:json][timeout:25];
(
  node["amenity"~"^(fast_food|cafe|restaurant|ice_cream|food_court|pub|bar)$"](around:3000,${lat},${lng});
  way["amenity"~"^(fast_food|cafe|restaurant|ice_cream|food_court)$"](around:3000,${lat},${lng});
  node["shop"~"^(bakery|deli|confectionery)$"](around:3000,${lat},${lng});
  node["amenity"="mobile_food_vendor"](around:3000,${lat},${lng});
);
out center body;`
    fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
    })
      .then(r => r.json())
      .then(json => {
        if (!mapRef.current) return
        const els = (json.elements ?? []).filter((e: any) => e.tags?.name && (e.lat != null || e.center?.lat != null))
        els.forEach((el: any) => {
          const bLat = el.lat ?? el.center?.lat
          const bLng = el.lon ?? el.center?.lon
          const b = {
            id: 'osm_' + el.id,
            name: el.tags.name,
            address: [el.tags['addr:housenumber'], el.tags['addr:street']].filter(Boolean).join(' '),
            latitude: bLat, longitude: bLng,
            phone: el.tags.phone ?? '', website: el.tags.website ?? '',
            food_type: el.tags.amenity ?? el.tags.shop ?? 'food_business',
            osm_id: String(el.id),
          }
          const m = L.marker([bLat, bLng], { icon: makeLocalBizIcon(L, getEmoji(b.food_type)) }).addTo(mapRef.current)
          m.on('click', () => {
            const ul2 = userLocRef.current
            m.bindPopup(localBizPopup(b, ul2?.lat ?? null, ul2?.lng ?? null, 'discovered'), { maxWidth: 280, minWidth: 260, className: 'ft-van-popup' }).openPopup()
          })
          allMarkersRef.current.push(m)
        })
        setCounts(c => ({ ...c, local: els.length }))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return

    const setup = async () => {
      const L = (await import('leaflet')).default
      leafletRef.current = L

      if (!document.querySelector('#leaflet-css')) {
        const link = document.createElement('link')
        link.id = 'leaflet-css'; link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      // Determine centre: prop > GPS > fallback
      let cLat = centerLat, cLng = centerLng
      let userGPS = null

      if (!cLat || !cLng) {
        userGPS = await getUserGPS()
        if (userGPS) { cLat = userGPS.lat; cLng = userGPS.lng }
        else { setLocationDenied(true) }
      }

      // Final fallback: London
      cLat = cLat ?? 51.5074
      cLng = cLng ?? -0.1278

      const map = L.map(mapContainerRef.current!, {
        center: [cLat, cLng], zoom: 14,
        zoomControl: true, attributionControl: false,
      })
      mapRef.current = map

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, subdomains: 'abcd',
      }).addTo(map)

      L.control.attribution({ position: 'bottomright', prefix: false })
        .addAttribution('© <a href="https://carto.com" style="color:#555">CARTO</a>')
        .addTo(map)

      // User GPS dot (only if GPS-derived centre, not search postcode)
      if (userGPS) {
        userLocRef.current = userGPS
        addUserDot(L, userGPS.lat, userGPS.lng)
      } else if (!centerLat && !centerLng) {
        // No GPS and no search — try getting GPS silently for dot/distances
        getUserGPS().then(gps => {
          if (gps && mapRef.current) {
            userLocRef.current = gps
            addUserDot(L, gps.lat, gps.lng)
          }
        })
      }

      // Load real data
      await loadMapData(L, cLat, cLng)

      // Real-time van updates via Supabase
      try {
        const { createClient } = await import('../../lib/supabase/client')
        const supabase = createClient()
        supabase.channel('van-live-map')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_locations' }, (payload) => {
            const { van_id, latitude, longitude } = payload.new as any
            const existing = markersRef.current.get(van_id)
            if (existing) {
              existing.marker.setLatLng([latitude, longitude])
              existing.lat = latitude; existing.lng = longitude
              markersRef.current.set(van_id, existing)
            }
          })
          .subscribe()
      } catch {}
    }

    setup()

    return () => {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current)
      allMarkersRef.current.forEach(m => { try { m.remove() } catch {} })
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [centerLat, centerLng, getUserGPS, addUserDot, loadMapData])

  const total = counts.live + counts.biz + counts.local

  return (
    <div style={{ position:'relative', height, borderRadius:24, overflow:'hidden', background:'#0d1117' }}>
      <style>{`
        @keyframes vanPulse { 0%{transform:scale(1);opacity:.2} 100%{transform:scale(2.8);opacity:0} }
        .ft-van-popup .leaflet-popup-content-wrapper { background:transparent!important;border:none!important;border-radius:16px!important;padding:0!important;box-shadow:0 20px 60px rgba(0,0,0,.8),0 0 0 1px rgba(255,255,255,.08)!important;overflow:hidden }
        .ft-van-popup .leaflet-popup-content { margin:0!important }
        .ft-van-popup .leaflet-popup-tip-container { display:none }
        .ft-van-popup .leaflet-popup-close-button { color:rgba(255,255,255,.4)!important;font-size:18px!important;top:8px!important;right:10px!important;z-index:10 }
        .leaflet-control-zoom a { background:rgba(7,11,20,.9)!important;color:#fff!important;border-color:rgba(255,255,255,.12)!important }
        .leaflet-bar { border:1px solid rgba(255,255,255,.12)!important;box-shadow:0 4px 14px rgba(0,0,0,.4)!important }
      `}</style>

      <div ref={mapContainerRef} style={{ width:'100%', height:'100%' }} />

      {/* Search label */}
      {searchLabel && (
        <div style={{ position:'absolute', top:14, left:'50%', transform:'translateX(-50%)', zIndex:1000, background:'rgba(249,115,22,.9)', backdropFilter:'blur(10px)', borderRadius:10, padding:'7px 16px', border:'1px solid rgba(249,115,22,.5)', whiteSpace:'nowrap' }}>
          <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>📍 {searchLabel}</span>
        </div>
      )}

      {/* Status badge */}
      <div style={{ position:'absolute', top: searchLabel ? 52 : 14, left:14, zIndex:1000, background:'rgba(6,9,20,.85)', backdropFilter:'blur(10px)', borderRadius:10, padding:'8px 14px', display:'flex', alignItems:'center', gap:8, border:'1px solid rgba(255,255,255,.1)' }}>
        {loading ? (
          <>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'#fbbf24', display:'inline-block' }} />
            <span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>Loading…</span>
          </>
        ) : total > 0 ? (
          <>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'#4ade80', display:'inline-block', boxShadow:'0 0 6px #4ade80' }} />
            <span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>
              {counts.live > 0 && `${counts.live} live van${counts.live>1?'s':''}`}
              {counts.live > 0 && counts.biz > 0 && ' · '}
              {counts.biz > 0 && `${counts.biz} business${counts.biz>1?'es':''}`}
              {(counts.live > 0 || counts.biz > 0) && counts.local > 0 && ' · '}
              {counts.local > 0 && `${counts.local} local`}
            </span>
          </>
        ) : (
          <>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'#6b7280', display:'inline-block' }} />
            <span style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,.5)' }}>No vans nearby</span>
          </>
        )}
      </div>

      {/* Find Nearest Van */}
      <button
        onClick={() => {
          if (!mapRef.current) return
          setFindingNearest(true)
          const doFind = (lat: number, lng: number) => {
            userLocRef.current = { lat, lng }
            let nearest: any = null; let minDist = Infinity
            markersRef.current.forEach(data => {
              const d = haversine(lat, lng, data.lat, data.lng)
              if (d < minDist) { minDist = d; nearest = data }
            })
            setFindingNearest(false)
            if (nearest) {
              mapRef.current.flyTo([nearest.lat, nearest.lng], 16, { duration: 1.4 })
              setTimeout(() => nearest.marker.fire('click'), 1500)
            }
          }
          if (userLocRef.current) { doFind(userLocRef.current.lat, userLocRef.current.lng); return }
          navigator.geolocation?.getCurrentPosition(
            p => doFind(p.coords.latitude, p.coords.longitude),
            () => setFindingNearest(false),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
          )
        }}
        style={{ position:'absolute', top: searchLabel ? 52 : 14, right:14, zIndex:1000, background: findingNearest ? 'rgba(251,191,36,.3)' : 'linear-gradient(135deg,#fbbf24,#f59e0b)', color:'#0a0a14', border:'none', borderRadius:10, padding:'9px 16px', fontWeight:800, fontSize:13, cursor: findingNearest ? 'wait' : 'pointer', display:'flex', alignItems:'center', gap:7, boxShadow:'0 4px 14px rgba(251,191,36,.35)' }}
      >
        {findingNearest ? '📍 Finding…' : '📍 Nearest Van'}
      </button>

      {/* Legend */}
      <div style={{ position:'absolute', bottom:50, right:14, zIndex:1000, background:'rgba(6,9,20,.88)', backdropFilter:'blur(10px)', borderRadius:12, padding:'10px 14px', border:'1px solid rgba(255,255,255,.08)', display:'flex', flexDirection:'column', gap:6 }}>
        {[
          { color:'#4ade80', label:'Live FoodTaxi Van', glow:true },
          { color:'#f97316', label:'Registered Business' },
          { color:'#6b7280', label:'Local Food Place' },
          { color:'#60a5fa', label:'You Are Here' },
        ].map(({ color, label, glow }) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:7 }}>
            <span style={{ width:12, height:12, borderRadius:'50%', background:color, display:'inline-block', boxShadow: glow ? `0 0 6px ${color}` : 'none' }} />
            <span style={{ fontSize:11, color:'rgba(255,255,255,.6)', fontWeight:600 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Location denied */}
      {locationDenied && !centerLat && (
        <div style={{ position:'absolute', bottom:50, left:'50%', transform:'translateX(-50%)', zIndex:1100, background:'rgba(239,68,68,.15)', backdropFilter:'blur(12px)', border:'1px solid rgba(239,68,68,.35)', borderRadius:14, padding:'10px 16px', display:'flex', alignItems:'center', gap:10, whiteSpace:'nowrap' }}>
          <span style={{ fontSize:13, color:'#fca5a5', fontWeight:600 }}>📍 Location not shared</span>
          <button onClick={() => {
            navigator.geolocation?.getCurrentPosition(p => {
              const { latitude: lat, longitude: lng } = p.coords
              userLocRef.current = { lat, lng }
              setLocationDenied(false)
              if (mapRef.current) mapRef.current.flyTo([lat, lng], 15)
              if (leafletRef.current) {
                addUserDot(leafletRef.current, lat, lng)
                loadMapData(leafletRef.current, lat, lng)
              }
            }, () => {}, { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 })
          }} style={{ background:'rgba(239,68,68,.25)', border:'1px solid rgba(239,68,68,.4)', borderRadius:8, padding:'5px 12px', color:'#fca5a5', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            Allow & Centre
          </button>
        </div>
      )}

      {/* Tap hint */}
      <div style={{ position:'absolute', bottom:14, left:'50%', transform:'translateX(-50%)', zIndex:1000, background:'rgba(6,9,20,.8)', backdropFilter:'blur(8px)', borderRadius:20, padding:'6px 14px', border:'1px solid rgba(255,255,255,.08)', whiteSpace:'nowrap' }}>
        <span style={{ fontSize:11, color:'rgba(255,255,255,.5)', fontWeight:600 }}>👆 Tap any marker for details & directions</span>
      </div>
    </div>
  )
}
