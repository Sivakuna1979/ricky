// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useWakeLock } from '@/lib/useWakeLock'
import { speakEnergetic } from '@/lib/speak'

// Public, no-login second screen for the customer facing away from the
// till — mirrors what staff are ringing up in /dashboard/pos in real time
// via a Supabase Realtime broadcast channel (nothing written to the DB).
export default function PosDisplayPage() {
  useWakeLock()
  const { vanId } = useParams<{ vanId: string }>()
  const [van, setVan] = useState<any>(null)
  const [sale, setSale] = useState<any>(null)
  const [justCompleted, setJustCompleted] = useState<any>(null)
  const [announcement, setAnnouncement] = useState<string | null>(null)

  useEffect(() => {
    if (!vanId) return
    const supabase = createClient()
    supabase.from('vans').select('name, profile_image_url').eq('id', vanId).maybeSingle()
      .then(({ data }) => setVan(data))

    const channel = supabase.channel(`pos-display-${vanId}`)
      .on('broadcast', { event: 'sale_update' }, ({ payload }) => setSale(payload))
      .on('broadcast', { event: 'sale_complete' }, ({ payload }) => {
        setJustCompleted(payload)
        setSale(null)
        setTimeout(() => setJustCompleted(null), 6000)
      })
      .on('broadcast', { event: 'order_ready' }, ({ payload }) => {
        setAnnouncement(payload.text)
        speakEnergetic(payload.text)
        setTimeout(() => setAnnouncement(null), 8000)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [vanId])

  const lines = sale?.lines ?? []
  const total = sale?.total ?? 0

  return (
    <div style={{ minHeight: '100vh', background: '#0e1527', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', padding: '32px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#f97316', letterSpacing: 1 }}>{van?.name ?? 'FoodTaxi'}</div>
      </div>

      {announcement && (
        <div style={{ background: '#10b981', color: '#fff', borderRadius: 16, padding: '18px 20px', marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 26, marginBottom: 4 }}>🔔</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{announcement}</div>
        </div>
      )}

      {justCompleted ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#6ee7b7', marginBottom: 8 }}>Thank you!</div>
          <div style={{ fontSize: 40, fontWeight: 900, marginBottom: 12 }}>£{Number(justCompleted.total ?? 0).toFixed(2)}</div>
          {justCompleted.changeDue > 0 && (
            <div style={{ fontSize: 20, color: '#93c5fd' }}>Change: £{Number(justCompleted.changeDue).toFixed(2)}</div>
          )}
        </div>
      ) : lines.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🍟</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Welcome!</div>
          <div style={{ fontSize: 14, marginTop: 4 }}>Your order will appear here</div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {lines.map((l: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>{l.qty}× {l.name}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>£{(l.price * l.qty).toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '2px solid rgba(255,255,255,0.15)', paddingTop: 16, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, fontWeight: 900 }}>
              <span>Total</span><span>£{total.toFixed(2)}</span>
            </div>
            {sale?.paymentMethod === 'cash_at_van' && sale?.tendered != null && sale.tendered > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 16, color: 'rgba(255,255,255,0.7)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cash received</span><span>£{Number(sale.tendered).toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: sale.tendered < total ? '#fca5a5' : '#6ee7b7', fontWeight: 700 }}>
                  <span>{sale.tendered < total ? 'Still owing' : 'Change due'}</span>
                  <span>£{Math.abs(total - sale.tendered).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
