// @ts-nocheck
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '../../lib/supabase/client'
import type { LiveLocation, Van } from '@/types/database'

interface VanWithLocation extends Van {
  location?: LiveLocation
}

interface Props {
  height?: string
  vanId?: string
}

// OpenStreetMap embed — always works, no API key needed
function OSMFallback({ height, vans }: { height: string; vans: VanWithLocation[] }) {
  // Centre on Manchester by default
  const lat = 53.4808
  const lng = -2.2426
  const zoom = 13
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.08}%2C${lat - 0.05}%2C${lng + 0.08}%2C${lat + 0.05}&layer=mapnik&marker=${lat}%2C${lng}`

  return (
    <div style={{ position: 'relative', height, borderRadius: 24, overflow: 'hidden' }}>
      <iframe
        src={src}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block', filter: 'invert(0.9) hue-rotate(180deg) saturate(0.8)' }}
        title="Van Map"
        loading="lazy"
      />
      {/* overlay badge */}
      <div style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(6,9,20,0.85)', backdropFilter: 'blur(10px)', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: vans.length > 0 ? '#4ade80' : '#9ca3af', display: 'inline-block' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
          {vans.length > 0 ? `${vans.length} van${vans.length > 1 ? 's' : ''} live nearby` : 'Live map — Manchester'}
        </span>
      </div>
      {/* OpenStreetMap attribution fix for dark filter */}
      <div style={{ position: 'absolute', bottom: 0, right: 0, background: 'rgba(6,9,20,0.7)', padding: '3px 8px', fontSize: 10, color: 'rgba(255,255,255,.5)' }}>
        © OpenStreetMap contributors
      </div>
    </div>
  )
}

export function VanMapPublic({ height = '400px', vanId }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const googleMapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map())
  const [vans, setVans] = useState<VanWithLocation[]>([])
  const [mapsLoaded, setMapsLoaded] = useState(false)
  const [mapsError, setMapsError] = useState(false)

  // Load Google Maps script — fall back to OSM if no key or load fails
  useEffect(() => {
    if (window.google?.maps) { setMapsLoaded(true); return }
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) { setMapsError(true); return }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.onload = () => setMapsLoaded(true)
    script.onerror = () => setMapsError(true)
    document.head.appendChild(script)
  }, [])

  // Init Google Map
  useEffect(() => {
    if (!mapsLoaded || !mapRef.current) return
    googleMapRef.current = new google.maps.Map(mapRef.current, {
      center: { lat: 53.4808, lng: -2.2426 },
      zoom: 12,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
    })
  }, [mapsLoaded])

  const updateMarkers = useCallback((updatedVans: VanWithLocation[]) => {
    if (!googleMapRef.current) return
    updatedVans.forEach(van => {
      if (!van.location) return
      const pos = { lat: van.location.latitude, lng: van.location.longitude }
      if (markersRef.current.has(van.id)) {
        markersRef.current.get(van.id)!.setPosition(pos)
      } else {
        const marker = new google.maps.Marker({
          position: pos,
          map: googleMapRef.current!,
          title: van.name,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="18" fill="${van.tracking_status === 'live' ? '#22c55e' : '#9ca3af'}" stroke="white" stroke-width="3"/>
                <text x="20" y="26" text-anchor="middle" font-size="18">🚐</text>
              </svg>
            `),
            scaledSize: new google.maps.Size(40, 40),
          },
        })
        const infoWindow = new google.maps.InfoWindow({
          content: `<div style="font-weight:700">${van.name}</div><div style="font-size:12px;color:#16a34a">● Live</div>`,
        })
        marker.addListener('click', () => infoWindow.open(googleMapRef.current, marker))
        markersRef.current.set(van.id, marker)
      }
    })
  }, [])

  // Fetch vans from Supabase
  useEffect(() => {
    const supabase = createClient()
    let query = supabase
      .from('live_locations')
      .select('*, vans!inner(id, name, slug, tracking_status, van_type)')
      .eq('vans.tracking_status', 'live')
    if (vanId) query = (query as any).eq('van_id', vanId)

    const fetchInitial = async () => {
      const { data } = await (query as any).order('recorded_at', { ascending: false }).limit(1)
      if (data) {
        const vanData = data.map((d: any) => ({ ...d.vans, location: d }))
        setVans(vanData)
        updateMarkers(vanData)
      }
    }
    fetchInitial()

    const channel = supabase
      .channel('live-locations')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_locations', ...(vanId ? { filter: `van_id=eq.${vanId}` } : {}) }, (payload) => {
        setVans(prev => {
          const updated = prev.map(v => v.id === payload.new.van_id ? { ...v, location: payload.new as LiveLocation } : v)
          updateMarkers(updated)
          return updated
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [vanId, updateMarkers])

  // No Google Maps API key — show OpenStreetMap
  if (mapsError) {
    return <OSMFallback height={height} vans={vans} />
  }

  if (!mapsLoaded) {
    return (
      <div style={{ height, background: 'rgba(255,255,255,.03)', borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.4)', fontSize: 14 }}>
        🗺️ Loading map…
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', height }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {vans.length === 0 && (
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(6,9,20,0.85)', backdropFilter: 'blur(10px)', borderRadius: 10, padding: '8px 16px', fontSize: 13, color: 'rgba(255,255,255,.6)', whiteSpace: 'nowrap' }}>
          No vans live right now — check back soon
        </div>
      )}
    </div>
  )
}
