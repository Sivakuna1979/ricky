// @ts-nocheck
'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Order received',
  accepted: 'Order confirmed',
  preparing: 'Being made',
  ready: 'Ready for collection!',
  collected: 'Completed',
  cancelled: 'Cancelled',
}

function elapsedLabel(iso: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins === 1) return '1 min ago'
  return `${mins} min ago`
}

export default function OrderStatusPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [error, setError] = useState('')
  const [, forceTick] = useState(0)
  const pollRef = useRef<any>(null)

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/orders/${id}`, { cache: 'no-store' })
      if (res.ok) setOrder(await res.json())
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    if (!id) return
    fetchOrder()
    pollRef.current = setInterval(fetchOrder, 6000)
    return () => clearInterval(pollRef.current)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the "checked in Xm ago" label fresh.
  useEffect(() => {
    const t = setInterval(() => forceTick(x => x + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const checkIn = async () => {
    setCheckingIn(true)
    setError('')
    try {
      const res = await fetch(`/api/orders/${id}/checkin`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Could not check in — please try again'); setCheckingIn(false); return }
      await fetchOrder()
    } catch {
      setError('Network error — please try again')
    }
    setCheckingIn(false)
  }

  if (loading) return (
    <div style={{ background: '#080c18', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'system-ui,sans-serif' }}>
      Loading…
    </div>
  )

  if (!order) return (
    <div style={{ background: '#080c18', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'system-ui,sans-serif', gap: 12, padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 48 }}>🔍</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>Order not found</div>
    </div>
  )

  const canCheckIn = ['pending', 'accepted', 'preparing'].includes(order.status) && !order.checked_in_at
  const items = order.order_items ?? []

  return (
    <div style={{ background: '#080c18', minHeight: '100vh', color: '#fff', fontFamily: 'system-ui,sans-serif', padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 4 }}>{order.vans?.name ?? 'Your order'}</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--brand, #f97316)' }}>#{(order.order_number ?? String(order.id).slice(0, 8)).toUpperCase()}</div>
        </div>

        <div style={{
          background: order.status === 'ready' ? 'color-mix(in srgb, #10b981 18%, transparent)' : '#0d1427',
          border: order.status === 'ready' ? '1px solid #10b981' : '1px solid #1e2a45',
          borderRadius: 16, padding: '18px 20px', marginBottom: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: order.status === 'ready' ? '#6ee7b7' : '#fff' }}>
            {order.status === 'ready' && '🔔 '}{STATUS_LABEL[order.status] ?? order.status}
          </div>
          {order.pickup_location && (
            <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>📍 {order.pickup_location}{order.pickup_time ? ` · ~${order.pickup_time}` : ''}</div>
          )}
        </div>

        {items.length > 0 && (
          <div style={{ background: '#0d1427', border: '1px solid #1e2a45', borderRadius: 16, padding: '14px 18px', marginBottom: 16 }}>
            {items.map((it: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '5px 0', fontSize: 14 }}>
                <span style={{ fontWeight: 800, color: '#f97316', minWidth: 24 }}>{it.quantity}×</span>
                <span style={{ color: '#e5e7eb' }}>{it.name}</span>
              </div>
            ))}
          </div>
        )}

        {['pending', 'accepted', 'preparing'].includes(order.status) && (
          order.checked_in_at ? (
            <div style={{ background: 'color-mix(in srgb, #10b981 14%, transparent)', border: '1px solid #10b981', borderRadius: 16, padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>🚗</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#6ee7b7' }}>You're checked in!</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>We know you're on your way — checked in {elapsedLabel(order.checked_in_at)}</div>
            </div>
          ) : (
            <>
              <button onClick={checkIn} disabled={checkingIn}
                style={{ width: '100%', padding: '16px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,var(--brand, #f97316),var(--brand2, #ea580c))', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', opacity: checkingIn ? 0.7 : 1 }}>
                {checkingIn ? 'Checking in…' : '🚗 I\'m on my way — Check In'}
              </button>
              <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 10 }}>Tap this when you leave — most orders take just 5-7 minutes, so we'll start cooking as soon as you check in.</div>
              {error && <div style={{ fontSize: 13, color: '#f87171', fontWeight: 700, textAlign: 'center', marginTop: 10 }}>⚠️ {error}</div>}
            </>
          )
        )}

        {order.status === 'collected' && (
          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>✅ This order is complete. Thanks for ordering!</div>
        )}
        {order.status === 'cancelled' && (
          <div style={{ textAlign: 'center', color: '#f87171', fontSize: 14 }}>This order was cancelled.</div>
        )}
      </div>
    </div>
  )
}
