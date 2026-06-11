'use client'
// @ts-nocheck
import { useEffect, useRef, useState, useCallback } from 'react'

interface PlaceResult {
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
  types: string[]
}

interface Props {
  height?: string
  centerLat?: number
  centerLng?: number
  searchLabel?: string
  showCards?: boolean
}

const FOOD_EMOJI: Record<string, string> = {
  fish_and_chips: '🐟',
  burger: '🍔',
  pizza: '🍕',
  coffee: '☕',
  ice_cream: '🍦',
  kebab: '🌯',
  street_food: '🌮',
  bakery: '🥐',
  fast_food: '🍟',
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

export function VanMapPublic({ height = '480px', centerLat, centerLng, searchLabel, showCards = false }: Props) {
  const mapRef = useRef<any>(null)
  const mapElRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<any[]>([])
  const userMarkerRef = useRef<any>(null)
  const watchIdRef = useRef<number | null>(null)
  const lastFetchRef = useRef<number>(0)

  const [places, setPlaces] = useState<PlaceResult[]>([])
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState<'distance' | 'rating'>('distance')

  const fetchPlaces = useCallback(async (lat: number, lng: number) => {
    const now = Date.now()
    if (now - lastFetchRef.current < 30000) return
    lastFetchRef.current = now
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/places/nearby?lat=${lat}&lng=${lng}&radius=16000`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to load places')
        setPlaces([])
      } else {
        setPlaces(data.results ?? [])
      }
    } catch {
      setError('Network error — could not load places')
    } finally {
      setLoading(false)
    }
  }, [])

  // Init map
  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return
    import('leaflet').then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
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
        fetchPlaces(centerLat, centerLng)
      }

      if (navigator.geolocation) {
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude: lat, longitude: lng } = pos.coords
            setUserPos({ lat, lng })
            if (userMarkerRef.current) {
              userMarkerRef.current.setLatLng([lat, lng])
            } else {
              const userIcon = L.divIcon({
                className: '',
                html: '<div style="width:16px;height:16px;border-radius:50%;background:#60a5fa;border:3px solid #fff;box-shadow:0 0 8px rgba(96,165,250,0.8)"></div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              })
              userMarkerRef.current = L.marker([lat, lng], { icon: userIcon })
                .addTo(map)
                .bindPopup('<b>You are here</b>')
            }
            if (centerLat == null || centerLng == null) {
              fetchPlaces(lat, lng)
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

  // Re-center when props change
  useEffect(() => {
    if (!mapRef.current || centerLat == null || centerLng == null) return
    mapRef.current.setView([centerLat, centerLng], 13)
    lastFetchRef.current = 0
    fetchPlaces(centerLat, centerLng)
  }, [centerLat, centerLng]) // eslint-disable-line react-hooks/exhaustive-deps

  // Render markers
  useEffect(() => {
    if (!mapRef.current) return
    import('leaflet').then((L) => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []

      places.forEach((p) => {
        if (p.lat == null || p.lng == null) return
        const emoji = FOOD_EMOJI[p.food_type] ?? '🍽️'
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:#f97316;border:2px solid rgba(255,255,255,0.8);border-radius:50% 50% 50% 0;width:32px;height:32px;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4)"><span style="transform:rotate(45deg);font-size:14px">${emoji}</span></div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32],
        })

        const dist = userPos ? haversine(userPos.lat, userPos.lng, p.lat, p.lng) : null
        const eta = dist ? Math.round((dist / 30) * 60) : null
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`

        const popup = `
          <div style="min-width:200px;font-family:system-ui,sans-serif">
            <div style="font-weight:800;font-size:14px;margin-bottom:4px">${emoji} ${p.name}</div>
            ${p.rating != null ? `<div style="color:#f59e0b;margin-bottom:4px">★ ${p.rating.toFixed(1)} <span style="color:#999;font-size:11px">(${p.total_ratings})</span></div>` : ''}
            ${p.open_now === true ? '<span style="background:#10b981;color:#fff;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:700">OPEN</span>' : p.open_now === false ? '<span style="background:#ef4444;color:#fff;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:700">CLOSED</span>' : ''}
            <div style="font-size:12px;color:#666;margin-top:6px">${p.address}</div>
            ${dist != null ? `<div style="font-size:12px;color:#888;margin-top:4px">📍 ${dist.toFixed(1)} mi · ~${eta} min drive</div>` : ''}
            <a href="${mapsUrl}" target="_blank" rel="noopener" style="display:inline-block;margin-top:10px;padding:7px 14px;background:#f97316;color:#fff;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700">🗺 Navigate</a>
          </div>`

        const marker = L.marker([p.lat, p.lng], { icon }).addTo(mapRef.current).bindPopup(popup)
        markersRef.current.push(marker)
      })
    })
  }, [places, userPos])

  const sortedPlaces = [...places]
    .filter((p) => p.lat != null && p.lng != null)
    .sort((a, b) => {
      if (sortBy === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      if (!userPos) return 0
      return haversine(userPos.lat, userPos.lng, a.lat!, a.lng!) - haversine(userPos.lat, userPos.lng, b.lat!, b.lng!)
    })

  return (
    <div>
      <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <div ref={mapElRef} style={{ height, width: '100%' }} />
        {loading && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, zIndex: 1000, backdropFilter: 'blur(8px)' }}>
            🔍 Searching nearby food places…
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(239,68,68,0.85)', color: '#fff', padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, zIndex: 1000 }}>
            ⚠ {error}
          </div>
        )}
        {!loading && places.length > 0 && (
          <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '6px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, zIndex: 1000 }}>
            {places.length} places found
          </div>
        )}
      </div>

      {showCards && places.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: 0 }}>
              {searchLabel ? `Food places near ${searchLabel}` : 'Nearby food places'} ({places.length})
            </h2>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['distance', 'rating'] as const).map((s) => (
                <button key={s} onClick={() => setSortBy(s)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: sortBy === s ? '#f97316' : 'rgba(255,255,255,0.08)', color: sortBy === s ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                  {s === 'distance' ? '📍 Nearest' : '⭐ Top Rated'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
            {sortedPlaces.map((p) => {
              const emoji = FOOD_EMOJI[p.food_type] ?? '🍽️'
              const dist = userPos ? haversine(userPos.lat, userPos.lng, p.lat!, p.lng!) : null
              const eta = dist ? Math.round((dist / 30) * 60) : null
              const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`
              return (
                <div key={p.place_id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#fff', lineHeight: 1.3 }}>{emoji} {p.name}</div>
                    {p.open_now === true && <span style={{ background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>OPEN</span>}
                    {p.open_now === false && <span style={{ background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>CLOSED</span>}
                  </div>
                  {p.rating != null && (
                    <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>★ {p.rating.toFixed(1)} <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>({p.total_ratings} reviews)</span></div>
                  )}
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>{p.address}</div>
                  {dist != null && (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>📍 {dist.toFixed(1)} mi · ~{eta} min drive</div>
                  )}
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ marginTop: 4, display: 'inline-block', padding: '8px 14px', background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', borderRadius: 10, textDecoration: 'none', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
                    🗺 Get Directions
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
