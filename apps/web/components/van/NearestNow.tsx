// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

function miles(lat1, lng1, lat2, lng2) {
  const toRad = (d) => d * Math.PI / 180
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2
  return 3959 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Shows registered FoodTaxi businesses immediately on page load; once the
// visitor's location arrives, sorts nearest-first and adds distances.
export function NearestNow() {
  const [items, setItems] = useState<any[]>([])
  const [pos, setPos] = useState<any>(null)
  const [placeName, setPlaceName] = useState('')

  // 1. Load registered businesses straight away — no location needed
  useEffect(() => {
    fetch('/api/foodtaxi-businesses')
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  // 2. Ask for location in parallel; upgrade the list when it arrives
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude })
        try {
          const d = await fetch(`https://api.postcodes.io/postcodes?lon=${p.coords.longitude}&lat=${p.coords.latitude}`).then(r => r.json())
          setPlaceName(d?.result?.[0]?.admin_district ?? '')
        } catch {}
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    )
  }, [])

  if (!items.length) return null

  const list = [...items]
    .map((b: any) => ({ ...b, dist: pos && b.lat != null ? miles(pos.lat, pos.lng, b.lat, b.lng) : null }))
    .sort((a: any, b: any) => (a.dist ?? 1e9) - (b.dist ?? 1e9))
    .slice(0, 5)

  return (
    <div style={{ maxWidth: 680, margin: '18px auto 0', width: '100%', textAlign: 'left' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#f97316', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
        {pos ? `📍 Nearest to you${placeName ? ` — ${placeName}` : ''}` : '⭐ Order online now'}
      </div>
      {list.map((b: any) => (
        <a key={b.slug} href={`/van/${b.slug}`}
          style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.4)', borderRadius: 16, padding: '12px 14px', marginBottom: 8, textDecoration: 'none', color: '#fff' }}>
          {b.logo ? (
            <img src={b.logo} alt={b.name} style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#f97316,#ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🍽️</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
              {b.dist != null ? `🚐 ${b.dist.toFixed(1)} mi away` : '🍽️ Order online'}{b.city ? ` · ${b.city}` : b.postcode ? ` · ${b.postcode}` : ''}
            </div>
          </div>
          <div style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>Order →</div>
        </a>
      ))}
    </div>
  )
}
