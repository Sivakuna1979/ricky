// @ts-nocheck
'use client'
import { useEffect, useRef, useState } from 'react'

const AVG_SPEED_MPH = 18 // urban van average for ETA estimates

function haversineMiles(lat1, lng1, lat2, lng2) {
  const toRad = (d) => d * Math.PI / 180
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2
  return 3959 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Uber-style live map: polls the van's location every 5s, glides the marker,
// and shows distance + ETA to the customer's pickup spot (or their location).
export function LiveVanTracker({ vanId, vanName, logo, pickup, height = '300px' }: any) {
  const mapRef = useRef<any>(null)
  const vanMarkerRef = useRef<any>(null)
  const pickupMarkerRef = useRef<any>(null)
  const userMarkerRef = useRef<any>(null)
  const fittedRef = useRef(false)
  const divRef = useRef<any>(null)
  const [loc, setLoc] = useState<any>(null)
  const [stale, setStale] = useState(false)
  const [userPos, setUserPos] = useState<any>(null)

  // Poll the van position
  useEffect(() => {
    let stop = false
    const poll = async () => {
      try {
        const d = await fetch(`/api/tracking/${vanId}/location?t=${Date.now()}`, { cache: 'no-store' }).then(r => r.json())
        if (stop) return
        if (d?.latitude) {
          setLoc(d)
          setStale(Date.now() - new Date(d.recorded_at).getTime() > 90e3)
        }
      } catch {}
    }
    poll()
    const t = setInterval(poll, 4000)
    return () => { stop = true; clearInterval(t) }
  }, [vanId])

  // Customer position (optional, for "distance from you")
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      p => setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {}, { enableHighAccuracy: false, timeout: 8000 }
    )
  }, [])

  // Map lifecycle
  useEffect(() => {
    if (!loc || !divRef.current) return
    import('leaflet').then((L) => {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link')
        link.id = 'leaflet-css'; link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }
      if (!mapRef.current) {
        mapRef.current = L.map(divRef.current, { zoomControl: true, attributionControl: false })
          .setView([loc.latitude, loc.longitude], 14)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(mapRef.current)
      }
      const vanIcon = L.divIcon({
        className: '',
        html: `<div style="width:46px;height:46px;border-radius:50%;background:#fff;border:3px solid #f97316;box-shadow:0 2px 12px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;overflow:hidden;">${logo ? `<img src="${logo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />` : '<span style="font-size:24px;">🚐</span>'}</div><div style="text-align:center;font-size:10px;font-weight:800;color:#f97316;text-shadow:0 1px 2px #fff;margin-top:2px;white-space:nowrap;">LIVE</div>`,
        iconSize: [46, 60], iconAnchor: [23, 30],
      })
      if (!vanMarkerRef.current) {
        vanMarkerRef.current = L.marker([loc.latitude, loc.longitude], { icon: vanIcon }).addTo(mapRef.current)
      } else {
        vanMarkerRef.current.setLatLng([loc.latitude, loc.longitude])
        // Keep the moving van on screen (gentle pan if it drifts near the edge)
        if (fittedRef.current && !mapRef.current.getBounds().pad(-0.15).contains([loc.latitude, loc.longitude])) {
          mapRef.current.panTo([loc.latitude, loc.longitude], { animate: true })
        }
      }
      if (pickup?.lat && !pickupMarkerRef.current) {
        pickupMarkerRef.current = L.marker([pickup.lat, pickup.lng], {
          icon: L.divIcon({ className: '', html: '<div style="font-size:30px;">📍</div>', iconSize: [30, 30], iconAnchor: [15, 30] }),
        }).addTo(mapRef.current).bindPopup(pickup.label ?? 'Your pickup')
      }
      // Customer's own "You are here" blue dot
      if (userPos) {
        const youIcon = L.divIcon({
          className: '',
          html: `<div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 4px rgba(59,130,246,0.3),0 2px 6px rgba(0,0,0,0.4);"></div><div style="text-align:center;font-size:9px;font-weight:800;color:#3b82f6;text-shadow:0 1px 2px #fff;margin-top:2px;white-space:nowrap;">YOU</div>`,
          iconSize: [18, 32], iconAnchor: [9, 9],
        })
        if (!userMarkerRef.current) userMarkerRef.current = L.marker([userPos.lat, userPos.lng], { icon: youIcon }).addTo(mapRef.current).bindPopup('📍 You are here')
        else userMarkerRef.current.setLatLng([userPos.lat, userPos.lng])
      }
      // Frame both van and the customer/pickup once
      if (!fittedRef.current) {
        const anchor = pickup?.lat ? pickup : userPos
        if (anchor) {
          fittedRef.current = true
          mapRef.current.fitBounds(L.latLngBounds([[loc.latitude, loc.longitude], [anchor.lat, anchor.lng]]), { padding: [50, 50], maxZoom: 15 })
        }
      }
    })
  }, [loc, pickup, logo, userPos])

  useEffect(() => () => { mapRef.current?.remove?.(); mapRef.current = null }, [])

  if (!loc) {
    return (
      <div style={{ background:'#0d1427', border:'1px solid #1e2a45', borderRadius:14, padding:'18px', textAlign:'center' }}>
        <div style={{ fontSize:28, marginBottom:6 }}>🛰</div>
        <div style={{ fontSize:14, fontWeight:700, color:'#9ca3af' }}>{vanName ?? 'The van'} isn't sharing its location right now</div>
        <div style={{ fontSize:12, color:'#4b5563', marginTop:4 }}>Live tracking appears here the moment the van goes on the road</div>
      </div>
    )
  }

  const target = pickup?.lat ? pickup : userPos
  const dist = target ? haversineMiles(loc.latitude, loc.longitude, target.lat, target.lng) : null
  const etaMin = dist != null ? Math.max(1, Math.round(dist / AVG_SPEED_MPH * 60)) : null

  return (
    <div style={{ borderRadius:14, overflow:'hidden', border: stale ? '1px solid #4b5563' : '1px solid rgba(16,185,129,0.5)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background: stale ? '#1f2937' : 'rgba(16,185,129,0.12)' }}>
        <div style={{ width:10, height:10, borderRadius:'50%', background: stale ? '#6b7280' : '#10b981', boxShadow: stale ? 'none' : '0 0 8px #10b981', animation: stale ? 'none' : 'pulse 1.5s infinite' }} />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:800, color: stale ? '#9ca3af' : '#6ee7b7' }}>
            {stale ? 'Last known position' : `${vanName ?? 'Van'} is LIVE`}
          </div>
          {dist != null && !stale && (
            <div style={{ fontSize:12, color:'#a7f3d0' }}>
              🚐 {dist.toFixed(1)} mi {pickup?.lat ? 'from your pickup' : 'from you'} · arriving in ~{etaMin} min
            </div>
          )}
        </div>
        <div style={{ fontSize:10, color:'#6b7280' }}>{new Date(loc.recorded_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}</div>
      </div>
      <div ref={divRef} style={{ height, width:'100%' }} />
      <div style={{ display:'flex', gap:8, padding:'8px', background:'#0d1427' }}>
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`} target="_blank" rel="noopener noreferrer"
          style={{ flex:1, textAlign:'center', padding:'10px', borderRadius:10, background:'linear-gradient(135deg,#f97316,#ea580c)', color:'#fff', fontWeight:800, fontSize:13, textDecoration:'none' }}>
          🧭 Directions to the van
        </a>
        {userPos && (
          <button onClick={() => { fittedRef.current = false; if (mapRef.current) mapRef.current.setView([userPos.lat, userPos.lng], 15) }}
            style={{ padding:'10px 14px', borderRadius:10, background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.4)', color:'#93c5fd', fontWeight:700, fontSize:13, cursor:'pointer' }}>
            📍 Me
          </button>
        )}
      </div>
      <style>{`@keyframes pulse{0%{opacity:1}50%{opacity:.4}100%{opacity:1}}`}</style>
    </div>
  )
}
