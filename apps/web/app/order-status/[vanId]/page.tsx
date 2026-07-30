// @ts-nocheck
'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useWakeLock } from '@/lib/useWakeLock'
import { speakAnnouncement } from '@/lib/speak'
import { shortOrderNumber } from '@/lib/orderNumber'

// Public, no-login order-status board — like the numbered board in a fast
// food shop. Independent of the till screen (polls the DB directly via a
// public API route), so it keeps working even if staff only use the
// Kitchen page and never open /dashboard/pos on this device.
export default function OrderStatusBoard() {
  useWakeLock()
  const { vanId } = useParams<{ vanId: string }>()
  const [van, setVan] = useState<any>(null)
  const [preparing, setPreparing] = useState<any[]>([])
  const [ready, setReady] = useState<any[]>([])
  const [online, setOnline] = useState(true)
  const seenReadyRef = useRef<Set<string>>(new Set())
  const firstFetchRef = useRef(true)
  const failCountRef = useRef(0)

  useEffect(() => {
    if (!vanId) return
    const supabase = createClient()
    supabase.from('vans').select('name, profile_image_url').eq('id', vanId).maybeSingle()
      .then(({ data }) => setVan(data))
  }, [vanId])

  useEffect(() => {
    if (!vanId) return
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/board/${vanId}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('bad response')
        const data = await res.json()
        if (cancelled) return
        failCountRef.current = 0
        setOnline(true)
        const preparingList = data.preparing ?? []
        const readyList = data.ready ?? []
        if (!firstFetchRef.current) {
          for (const o of readyList) {
            if (!seenReadyRef.current.has(o.id)) {
              const who = o.guest_name && o.guest_name !== 'Walk-in customer' ? o.guest_name : `Order ${shortOrderNumber(o.order_number)}`
              speakAnnouncement(`${who}, your order is ready for collection!`)
            }
          }
        }
        seenReadyRef.current = new Set(readyList.map((o: any) => o.id))
        firstFetchRef.current = false
        setPreparing(preparingList)
        setReady(readyList)
      } catch {
        // Transient blips are normal over Bluetooth tethering — only flag it
        // as actually offline after a couple of misses in a row, and keep
        // showing the last known board instead of clearing it.
        if (cancelled) return
        failCountRef.current += 1
        if (failCountRef.current >= 2) setOnline(false)
      }
    }
    poll()
    const interval = setInterval(poll, 4000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [vanId])

  const empty = preparing.length === 0 && ready.length === 0

  return (
    <div style={{ minHeight: '100vh', background: '#0e1527', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', padding: '28px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#f97316', letterSpacing: 1 }}>{van?.name ?? 'FoodTaxi'}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Order Status</div>
      </div>

      {!online && (
        <div style={{ background: '#b45309', color: '#fff', borderRadius: 10, padding: '8px 14px', marginBottom: 16, textAlign: 'center', fontSize: 12, fontWeight: 800 }}>
          ⚠️ Connection lost — check this screen's Bluetooth/internet link. Showing the last known board.
        </div>
      )}

      {empty ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'rgba(255,255,255,0.35)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🍟</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>No orders in progress</div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 20 }}>🍳</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#fbbf24', letterSpacing: 0.5, textTransform: 'uppercase' }}>Preparing</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {preparing.length === 0 && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>—</div>}
              {preparing.map(o => (
                <div key={o.id} style={{ background: 'rgba(251,191,36,0.12)', border: '2px solid #fbbf24', borderRadius: 16, padding: '14px 18px', textAlign: 'center', minWidth: 84 }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: '#fbbf24' }}>{shortOrderNumber(o.order_number)}</div>
                  {o.guest_name && o.guest_name !== 'Walk-in customer' && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }}>{o.guest_name}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 20 }}>🔔</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#6ee7b7', letterSpacing: 0.5, textTransform: 'uppercase' }}>Ready for Collection</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {ready.length === 0 && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>—</div>}
              {ready.map(o => (
                <div key={o.id} style={{ background: 'rgba(16,185,129,0.18)', border: '2px solid #10b981', borderRadius: 16, padding: '16px 20px', textAlign: 'center', minWidth: 96 }}>
                  <div style={{ fontSize: 38, fontWeight: 900, color: '#6ee7b7' }}>{shortOrderNumber(o.order_number)}</div>
                  {o.guest_name && o.guest_name !== 'Walk-in customer' && (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>{o.guest_name}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
