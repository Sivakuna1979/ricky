// @ts-nocheck
'use client'
import { useEffect, useRef, useState } from 'react'
import { LiveVanTracker } from '@/components/map/LiveVanTracker'

// Driver-side: GO LIVE streams GPS from this phone every ~5 seconds while the
// page stays open (like Uber driver mode).
export function GoLiveVan({ van }: any) {
  const [live, setLive] = useState(van.tracking_status === 'live')
  const [sharing, setSharing] = useState(false)
  const [pings, setPings] = useState(0)
  const [error, setError] = useState('')
  const watchRef = useRef<any>(null)
  const lastSentRef = useRef(0)
  const wakeLockRef = useRef<any>(null)

  const goLive = async () => {
    setError('')
    if (!navigator.geolocation) { setError('This phone does not support GPS in the browser.'); return }
    try {
      await fetch(`/api/tracking/${van.id}/start`, { method: 'POST' })
      // Keep the screen awake while driving mode is on (best effort)
      try { wakeLockRef.current = await (navigator as any).wakeLock?.request?.('screen') } catch {}
      watchRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          const now = Date.now()
          if (now - lastSentRef.current < 5000) return // throttle to ~5s
          lastSentRef.current = now
          const res = await fetch(`/api/tracking/${van.id}/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              heading: pos.coords.heading ?? null,
              speed: pos.coords.speed ?? null,
              accuracy: pos.coords.accuracy ?? null,
            }),
          }).catch(() => null)
          if (res?.ok) setPings(p => p + 1)
        },
        (err) => setError(err.code === 1 ? 'Location permission denied — allow location for this site in your phone settings.' : `GPS error: ${err.message}`),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
      )
      setSharing(true)
      setLive(true)
    } catch (e: any) {
      setError(e.message)
    }
  }

  const stop = async () => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
    watchRef.current = null
    try { await wakeLockRef.current?.release?.() } catch {}
    await fetch(`/api/tracking/${van.id}/stop`, { method: 'POST' }).catch(() => {})
    setSharing(false)
    setLive(false)
  }

  useEffect(() => () => { if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current) }, [])

  return (
    <div style={{ borderRadius:14, background:'#f9fafb', border: sharing ? '2px solid #10b981' : '1px solid #e5e7eb', padding:'16px', marginBottom:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
        <div style={{ width:12, height:12, borderRadius:'50%', background: live ? '#10b981' : '#d1d5db', flexShrink:0, boxShadow: sharing ? '0 0 8px #10b981' : 'none' }} />
        <div style={{ flex:1, minWidth:140 }}>
          <div style={{ fontWeight:800, fontSize:15, color:'#111' }}>{van.name || 'Unnamed Van'}</div>
          <div style={{ fontSize:12, color:'#888', marginTop:2 }}>
            {sharing ? `🛰 Sharing live — ${pings} updates sent` : live ? '🟢 Marked live' : '⚫ Offline'}
          </div>
        </div>
        {!sharing ? (
          <button onClick={goLive}
            style={{ padding:'14px 26px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#10b981,#059669)', color:'#fff', fontWeight:900, fontSize:15, cursor:'pointer', boxShadow:'0 2px 10px rgba(16,185,129,0.4)' }}>
            🟢 GO LIVE
          </button>
        ) : (
          <button onClick={stop}
            style={{ padding:'14px 26px', borderRadius:12, border:'none', background:'#ef4444', color:'#fff', fontWeight:900, fontSize:15, cursor:'pointer' }}>
            ⏹ STOP
          </button>
        )}
      </div>
      {sharing && (
        <>
          <div style={{ fontSize:12, color:'#059669', fontWeight:700, marginTop:10 }}>
            📍 Customers can now watch your van move on your page. Keep this page open while trading/driving.
          </div>
          <div style={{ marginTop:10 }}>
            <LiveVanTracker vanId={van.id} vanName={van.name} logo={van.brand?.logo} height="220px" />
          </div>
        </>
      )}
      {error && <div style={{ fontSize:13, fontWeight:700, color:'#ef4444', marginTop:8 }}>⚠️ {error}</div>}
    </div>
  )
}
