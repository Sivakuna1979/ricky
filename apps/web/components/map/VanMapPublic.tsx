// @ts-nocheck
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '../../lib/supabase/client'

interface Props {
  height?: string
  vanId?: string
}

// Demo vans that move around Manchester for visual testing when no real vans are live
const DEMO_VANS = [
  { id: 'demo-1', name: "Smith's Fish & Chips", emoji: '🐟', color: '#3b82f6', lat: 53.4808, lng: -2.2426 },
  { id: 'demo-2', name: 'Blue Sky Burgers',     emoji: '🍔', color: '#f97316', lat: 53.4750, lng: -2.2350 },
  { id: 'demo-3', name: 'Bella Italia Street',  emoji: '🍕', color: '#ef4444', lat: 53.4870, lng: -2.2500 },
]

function makeVanIcon(L: any, emoji: string, color: string, isLive = true) {
  return L.divIcon({
    html: `
      <div style="position:relative;width:44px;height:44px">
        <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:.25;animation:vanPulse 2s ease-out infinite"></div>
        <div style="position:absolute;inset:4px;border-radius:50%;background:${isLive ? color : '#6b7280'};display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,.5);border:2px solid rgba(255,255,255,.8)">${emoji}</div>
      </div>
    `,
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  })
}

export function VanMapPublic({ height = '480px', vanId }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const [vanCount, setVanCount] = useState(0)
  const [isDemo, setIsDemo] = useState(false)
  const demoIntervalRef = useRef<any>(null)

  const initMap = useCallback(async () => {
    if (mapRef.current || !mapContainerRef.current) return

    // Dynamically import Leaflet (client-only)
    const L = (await import('leaflet')).default

    // Fix default marker icon paths broken by webpack
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })

    // Create map
    const map = L.map(mapContainerRef.current, {
      center: [53.4808, -2.2426],
      zoom: 13,
      zoomControl: true,
      attributionControl: false,
    })
    mapRef.current = map

    // Dark tile layer — CartoDB Dark Matter (free, no API key)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map)

    // Small attribution
    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution('© <a href="https://carto.com" style="color:#888">CARTO</a>')
      .addTo(map)

    return L
  }, [])

  // Animate demo vans moving around Manchester
  const startDemoMovement = useCallback((L: any) => {
    setIsDemo(true)
    // Add demo markers
    DEMO_VANS.forEach(van => {
      const marker = L.marker([van.lat, van.lng], {
        icon: makeVanIcon(L, van.emoji, van.color, true),
      })
        .addTo(mapRef.current)
        .bindPopup(`
          <div style="font-family:sans-serif;padding:4px 2px">
            <div style="font-weight:700;font-size:14px">${van.emoji} ${van.name}</div>
            <div style="font-size:12px;color:#4ade80;margin-top:4px">● Live — demo mode</div>
          </div>
        `)
      markersRef.current.set(van.id, { marker, lat: van.lat, lng: van.lng })
    })

    // Move each van slightly every 2 seconds
    demoIntervalRef.current = setInterval(() => {
      markersRef.current.forEach((data, id) => {
        const newLat = data.lat + (Math.random() - 0.5) * 0.0015
        const newLng = data.lng + (Math.random() - 0.5) * 0.0015
        data.marker.setLatLng([newLat, newLng])
        data.lat = newLat
        data.lng = newLng
        markersRef.current.set(id, data)
      })
    }, 2000)

    setVanCount(DEMO_VANS.length)
  }, [])

  useEffect(() => {
    let L: any = null

    const setup = async () => {
      L = await initMap()
      if (!L) return

      // Load Leaflet CSS
      if (!document.querySelector('#leaflet-css')) {
        const link = document.createElement('link')
        link.id = 'leaflet-css'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      const supabase = createClient()

      // Fetch live vans from Supabase
      let query = supabase
        .from('live_locations')
        .select('*, vans!inner(id, name, van_type, tracking_status)')
        .eq('vans.tracking_status', 'live')
      if (vanId) query = (query as any).eq('van_id', vanId)

      const { data: liveData } = await (query as any)
        .order('recorded_at', { ascending: false })
        .limit(50)

      const emojiMap: Record<string, string> = {
        fish_and_chips: '🐟', burger: '🍔', pizza: '🍕',
        coffee: '☕', ice_cream: '🍦', dessert: '🍰',
        street_food: '🥙', catering_trailer: '🚐',
      }
      const colorMap: Record<string, string> = {
        fish_and_chips: '#3b82f6', burger: '#f97316', pizza: '#ef4444',
        coffee: '#d97706', ice_cream: '#8b5cf6', dessert: '#ec4899',
        street_food: '#10b981', catering_trailer: '#6366f1',
      }

      if (liveData && liveData.length > 0) {
        // Real vans are live — show them
        liveData.forEach((loc: any) => {
          const van = loc.vans
          const emoji = emojiMap[van.van_type] ?? '🚐'
          const color = colorMap[van.van_type] ?? '#f97316'
          const marker = L.marker([loc.latitude, loc.longitude], {
            icon: makeVanIcon(L, emoji, color, true),
          })
            .addTo(mapRef.current)
            .bindPopup(`
              <div style="font-family:sans-serif;padding:4px 2px">
                <div style="font-weight:700;font-size:14px">${emoji} ${van.name}</div>
                <div style="font-size:12px;color:#4ade80;margin-top:4px">● Live now</div>
              </div>
            `)
          markersRef.current.set(van.id, { marker, lat: loc.latitude, lng: loc.longitude })
        })
        setVanCount(liveData.length)

        // Centre map on first van
        const first = liveData[0]
        mapRef.current.setView([first.latitude, first.longitude], 13)
      } else {
        // No real vans — show animated demo
        startDemoMovement(L)
      }

      // Real-time subscription for live van positions
      const channel = supabase
        .channel('van-live-locations')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'live_locations',
          ...(vanId ? { filter: `van_id=eq.${vanId}` } : {}),
        }, (payload) => {
          const { van_id, latitude, longitude } = payload.new as any
          const existing = markersRef.current.get(van_id)
          if (existing) {
            // Smooth movement via setLatLng
            existing.marker.setLatLng([latitude, longitude])
            markersRef.current.set(van_id, { ...existing, lat: latitude, lng: longitude })
          }
          setVanCount(markersRef.current.size)
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
        if (demoIntervalRef.current) clearInterval(demoIntervalRef.current)
      }
    }

    const cleanup = setup()
    return () => {
      cleanup.then(fn => fn?.())
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current)
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markersRef.current.clear()
      }
    }
  }, [vanId, initMap, startDemoMovement])

  return (
    <div style={{ position: 'relative', height, borderRadius: 24, overflow: 'hidden', background: '#0d1117' }}>
      <style>{`
        @keyframes vanPulse {
          0% { transform: scale(1); opacity: .25 }
          100% { transform: scale(2.5); opacity: 0 }
        }
        .leaflet-popup-content-wrapper {
          background: #0d1117 !important;
          border: 1px solid rgba(255,255,255,.12) !important;
          border-radius: 12px !important;
          color: #fff !important;
          box-shadow: 0 8px 32px rgba(0,0,0,.6) !important;
        }
        .leaflet-popup-tip { background: #0d1117 !important }
        .leaflet-popup-close-button { color: rgba(255,255,255,.5) !important }
        .leaflet-control-zoom a {
          background: #0d1117 !important;
          color: #fff !important;
          border-color: rgba(255,255,255,.15) !important;
        }
        .leaflet-control-zoom a:hover { background: rgba(255,255,255,.1) !important }
      `}</style>

      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Status badge */}
      <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 1000, background: 'rgba(6,9,20,0.85)', backdropFilter: 'blur(10px)', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(255,255,255,.1)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 6px #4ade80' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
          {vanCount > 0 ? `${vanCount} van${vanCount > 1 ? 's' : ''} live` : 'Loading…'}
        </span>
        {isDemo && (
          <span style={{ fontSize: 10, color: '#fbbf24', fontWeight: 600, background: 'rgba(251,191,36,.15)', padding: '2px 6px', borderRadius: 6 }}>DEMO</span>
        )}
      </div>
    </div>
  )
}
