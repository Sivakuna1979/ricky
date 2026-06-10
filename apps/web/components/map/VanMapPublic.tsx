// @ts-nocheck
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '../../lib/supabase/client'

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

function buildPopupHTML(
  name: string, emoji: string, color: string, vanLat: number, vanLng: number,
  userLat: number | null, userLng: number | null,
  isLive: boolean, slug: string, phone: string, vanId: string
) {
  const hasLocation = userLat !== null && userLng !== null
  const km = hasLocation ? haversine(userLat!, userLng!, vanLat, vanLng) : null
  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${vanLat},${vanLng}&travelmode=driving`

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
        <div style="font-size:12px;color:rgba(255,255,255,.35);text-align:center">Enable location for distance & ETA</div>
      </div>
      `}

      <!-- Buttons -->
      <div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px">

        <!-- Navigate button -->
        <a href="${navUrl}" target="_blank" rel="noopener noreferrer"
          onclick="window.open('${navUrl}','_blank');return false;"
          style="display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 16px;border-radius:10px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;font-size:13px;font-weight:800;text-decoration:none;box-shadow:0 4px 14px rgba(249,115,22,.4);letter-spacing:-.01em">
          📍 Navigate To Van
        </a>

        <!-- Call + Menu row -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${phone ? `
          <a href="tel:${phone}"
            style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 8px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.85);font-size:12px;font-weight:700;text-decoration:none">
            📞 Call Van
          </a>
          ` : `
          <div style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 8px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);color:rgba(255,255,255,.25);font-size:12px;font-weight:700;cursor:not-allowed">
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
  const demoIntervalRef = useRef<any>(null)

  // Get user location silently
  const requestUserLocation = useCallback((L: any) => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLocationRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        // Add a subtle "You are here" marker
        L.circleMarker([pos.coords.latitude, pos.coords.longitude], {
          radius: 8,
          fillColor: '#60a5fa',
          color: '#fff',
          weight: 2,
          fillOpacity: 0.9,
        }).addTo(mapRef.current).bindTooltip('You are here', { permanent: false, direction: 'top' })
      },
      () => {}, // silently ignore permission denial
      { enableHighAccuracy: true, timeout: 8000 }
    )
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

  const startDemoMovement = useCallback((L: any) => {
    setIsDemo(true)
    DEMO_VANS.forEach(van => {
      buildMarker(L, van.id, van.name, van.emoji, van.color, van.lat, van.lng, true, van.slug, van.phone)
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

      // Dark tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, subdomains: 'abcd',
      }).addTo(map)

      L.control.attribution({ position: 'bottomright', prefix: false })
        .addAttribution('© <a href="https://carto.com" style="color:#555">CARTO</a>')
        .addTo(map)

      // Get user location
      requestUserLocation(L)

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
        map.setView([liveData[0].latitude, liveData[0].longitude], 13)
      } else {
        startDemoMovement(L)
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
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
      markersRef.current.clear()
    }
  }, [vanId, requestUserLocation, buildMarker, startDemoMovement])

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

      {/* Tap hint */}
      <div style={{ position:'absolute', bottom:14, left:'50%', transform:'translateX(-50%)', zIndex:1000, background:'rgba(6,9,20,.8)', backdropFilter:'blur(8px)', borderRadius:20, padding:'6px 14px', border:'1px solid rgba(255,255,255,.08)', whiteSpace:'nowrap' }}>
        <span style={{ fontSize:11, color:'rgba(255,255,255,.5)', fontWeight:600 }}>👆 Tap a van to navigate</span>
      </div>
    </div>
  )
}
