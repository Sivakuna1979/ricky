// @ts-nocheck
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { LiveLocation, Van } from '@/types/database'

interface VanWithLocation extends Van {
  location?: LiveLocation
}

interface Props {
  height?: string
  vanId?: string  // if set, show only this van
}

export function VanMapPublic({ height = '400px', vanId }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const googleMapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map())
  const [vans, setVans] = useState<VanWithLocation[]>([])
  const [mapsLoaded, setMapsLoaded] = useState(false)

  // Load Google Maps script
  useEffect(() => {
    if (window.google?.maps) { setMapsLoaded(true); return }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`
    script.async = true
    script.onload = () => setMapsLoaded(true)
    document.head.appendChild(script)
  }, [])

  // Init map
  useEffect(() => {
    if (!mapsLoaded || !mapRef.current) return
    googleMapRef.current = new google.maps.Map(mapRef.current, {
      center: { lat: 53.4808, lng: -2.2426 }, // Manchester default
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
          content: `<div class="font-semibold">${van.name}</div><div class="text-xs text-green-600">● Live</div>`,
        })
        marker.addListener('click', () => infoWindow.open(googleMapRef.current, marker))
        markersRef.current.set(van.id, marker)
      }
    })
  }, [])

  // Subscribe to real-time location updates
  useEffect(() => {
    const supabase = createClient()

    let query = supabase
      .from('live_locations')
      .select('*, vans!inner(id, name, slug, tracking_status, van_type)')
      .eq('vans.tracking_status', 'live')

    if (vanId) query = (query as any).eq('van_id', vanId)

    // Initial fetch
    const fetchInitial = async () => {
      const { data } = await (query as any).order('recorded_at', { ascending: false }).limit(1)
      if (data) {
        const vanData = data.map((d: any) => ({ ...d.vans, location: d }))
        setVans(vanData)
        updateMarkers(vanData)
      }
    }
    fetchInitial()

    // Real-time subscription
    const channel = supabase
      .channel('live-locations')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_locations',
        ...(vanId ? { filter: `van_id=eq.${vanId}` } : {}),
      }, (payload) => {
        setVans(prev => {
          const updated = prev.map(v =>
            v.id === payload.new.van_id ? { ...v, location: payload.new as LiveLocation } : v
          )
          updateMarkers(updated)
          return updated
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [vanId, updateMarkers])

  if (!mapsLoaded) {
    return <div style={{ height }} className="bg-gray-200 rounded-xl animate-pulse flex items-center justify-center text-gray-400">Loading map...</div>
  }

  return (
    <div className="relative rounded-xl overflow-hidden" style={{ height }}>
      <div ref={mapRef} className="w-full h-full" />
      {vans.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-xl shadow px-4 py-2 text-sm text-gray-600">
            No vans currently live in this area
          </div>
        </div>
      )}
    </div>
  )
}
