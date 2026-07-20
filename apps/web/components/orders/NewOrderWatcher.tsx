// @ts-nocheck
'use client'
import { useEffect, useRef, useState } from 'react'

// Polls for new pending orders every 20s while any dashboard page is open.
// New order => chime + vibration + browser notification + title flash.
export function NewOrderWatcher() {
  const [pending, setPending] = useState<number | null>(null)
  const [alertsOn, setAlertsOn] = useState(false)
  const lastIdRef = useRef<string | null>(null)
  const firstRunRef = useRef(true)

  const chime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const notes = [880, 1108, 1318]
      notes.forEach((f, i) => {
        const o = ctx.createOscillator(); const g = ctx.createGain()
        o.frequency.value = f; o.type = 'sine'
        o.connect(g); g.connect(ctx.destination)
        const t = ctx.currentTime + i * 0.15
        g.gain.setValueAtTime(0.001, t)
        g.gain.exponentialRampToValueAtTime(0.4, t + 0.02)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
        o.start(t); o.stop(t + 0.4)
      })
    } catch {}
    try { navigator.vibrate?.([200, 100, 200]) } catch {}
  }

  const enableAlerts = async () => {
    try {
      if ('Notification' in window && Notification.permission !== 'granted') {
        await Notification.requestPermission()
      }
    } catch {}
    chime()
    setAlertsOn(true)
  }

  useEffect(() => {
    let stop = false
    const poll = async () => {
      try {
        const d = await fetch('/api/orders/watch').then(r => r.json())
        if (stop || d?.error) return
        setPending(d.pending ?? 0)
        const latestId = d.latest?.id ?? null
        if (!firstRunRef.current && latestId && latestId !== lastIdRef.current) {
          chime()
          document.title = `🔔 NEW ORDER — FoodTaxi`
          setTimeout(() => { document.title = 'FoodTaxi' }, 15000)
          try {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('🔔 New FoodTaxi order!', {
                body: `#${d.latest.order_number ?? ''} · £${Number(d.latest.total ?? 0).toFixed(2)}${d.latest.guest_name ? ` · ${d.latest.guest_name}` : ''}`,
              })
            }
          } catch {}
        }
        if (latestId) lastIdRef.current = latestId
        firstRunRef.current = false
      } catch {}
    }
    poll()
    const t = setInterval(poll, 20000)
    return () => { stop = true; clearInterval(t) }
  }, [])

  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
      {pending != null && pending > 0 && (
        <a href="/dashboard/orders" style={{ background:'#fef3c7', color:'#92400e', borderRadius:20, padding:'6px 14px', fontSize:13, fontWeight:800, textDecoration:'none' }}>
          🔔 {pending} pending order{pending > 1 ? 's' : ''}
        </a>
      )}
      {!alertsOn ? (
        <button onClick={enableAlerts}
          style={{ background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe', borderRadius:20, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
          🔕 Tap to enable order alerts (sound + notification)
        </button>
      ) : (
        <span style={{ background:'#f0fdf4', color:'#166534', borderRadius:20, padding:'6px 14px', fontSize:12, fontWeight:700 }}>
          🔔 Order alerts ON — keep this tab open
        </span>
      )}
    </div>
  )
}
