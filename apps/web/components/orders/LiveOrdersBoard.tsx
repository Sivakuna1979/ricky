// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/types/database'
import { OrderCard } from './OrderCard'

interface Props {
  vanIds: string[]
}

const COLUMNS: { status: Order['status']; label: string; color: string }[] = [
  { status: 'pending', label: 'New Orders', color: 'border-amber-400' },
  { status: 'accepted', label: 'Accepted', color: 'border-blue-400' },
  { status: 'preparing', label: 'Preparing', color: 'border-purple-400' },
  { status: 'ready', label: 'Ready', color: 'border-green-400' },
]

export function LiveOrdersBoard({ vanIds }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (!vanIds.length) return

    const fetchOrders = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*), route_stops(name, postcode), customers(users(full_name, phone))')
        .in('van_id', vanIds)
        .in('status', ['pending', 'accepted', 'preparing', 'ready'])
        .order('created_at', { ascending: true })

      setOrders((data as any) ?? [])
    }

    fetchOrders()

    const channel = supabase
      .channel('orders-live')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `van_id=in.(${vanIds.join(',')})`,
      }, () => fetchOrders())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [vanIds.join(',')])

  const ordersForStatus = (status: Order['status']) =>
    orders.filter(o => o.status === status)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {COLUMNS.map(col => (
        <div key={col.status} className={`bg-gray-50 rounded-xl border-t-4 ${col.color} p-4`}>
          <h3 className="font-semibold text-gray-700 mb-3 text-sm">
            {col.label}
            <span className="ml-2 bg-gray-200 text-gray-600 text-xs rounded-full px-2 py-0.5">
              {ordersForStatus(col.status).length}
            </span>
          </h3>
          <div className="space-y-3">
            {ordersForStatus(col.status).map(order => (
              <OrderCard key={order.id} order={order as any} />
            ))}
            {ordersForStatus(col.status).length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No orders</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
