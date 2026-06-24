'use client'

import { useState } from 'react'
import type { Order, OrderItem } from '../../types/database'
import { toast } from 'sonner'
import { formatCurrency } from '../../lib/utils/format'

type OrderWithItems = Order & {
  order_items: OrderItem[]
  customers?: { users: { full_name: string; phone: string | null } }
  route_stops?: { name: string; postcode: string } | null
}

const NEXT_STATUS: Record<string, string> = {
  pending: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'collected',
}

const ACTION_LABEL: Record<string, string> = {
  pending: 'Accept Order',
  accepted: 'Start Preparing',
  preparing: 'Mark Ready',
  ready: 'Mark Collected',
}

export function OrderCard({ order }: { order: OrderWithItems }) {
  const [status, setStatus] = useState(order.status)
  const [loading, setLoading] = useState(false)

  const advance = async () => {
    const next = NEXT_STATUS[status]
    if (!next) return
    setLoading(true)
    const res = await fetch(`/api/orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (res.ok) {
      setStatus(next as Order['status'])
      toast.success(`Order ${order.order_number} → ${next}`)
    } else {
      toast.error('Failed to update order')
    }
    setLoading(false)
  }

  const cancel = async () => {
    if (!confirm('Cancel this order?')) return
    setLoading(true)
    await fetch(`/api/orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled', cancel_reason: 'Cancelled by van' }),
    })
    setStatus('cancelled')
    setLoading(false)
  }

  if (status === 'collected' || status === 'cancelled') return null

  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-600">#{order.order_number}</span>
        <span className="text-xs text-gray-400">{formatCurrency(order.total)}</span>
      </div>

      <p className="text-sm font-medium text-gray-900 truncate">
        {order.customers?.users.full_name ?? 'Customer'}
      </p>
      {(order as any).pickup_location ? (
        <p className="text-xs text-orange-500 font-semibold truncate">📍 {(order as any).pickup_location}{(order as any).pickup_time ? ` · ~${(order as any).pickup_time}` : ''}</p>
      ) : order.route_stops ? (
        <p className="text-xs text-gray-500 truncate">📍 {order.route_stops.name}</p>
      ) : null}

      <div className="mt-2 space-y-0.5">
        {order.order_items.slice(0, 3).map(item => (
          <p key={item.id} className="text-xs text-gray-600">× {item.quantity} {item.name}</p>
        ))}
        {order.order_items.length > 3 && (
          <p className="text-xs text-gray-400">+{order.order_items.length - 3} more</p>
        )}
      </div>

      {NEXT_STATUS[status] && (
        <button
          onClick={advance}
          disabled={loading}
          className="w-full mt-3 bg-brand-500 text-white text-xs font-semibold py-2 rounded-lg hover:bg-brand-600 disabled:opacity-50"
        >
          {loading ? '...' : ACTION_LABEL[status]}
        </button>
      )}

      {status === 'pending' && (
        <button
          onClick={cancel}
          disabled={loading}
          className="w-full mt-1 text-red-500 text-xs py-1 hover:underline"
        >
          Reject
        </button>
      )}
    </div>
  )
}
