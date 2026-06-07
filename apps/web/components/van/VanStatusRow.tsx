'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Van } from '@/types/database'
import { TrackingBadge } from './TrackingBadge'
import { toast } from 'sonner'

interface Props {
  van: Van
  businessId: string
}

export function VanStatusRow({ van, businessId }: Props) {
  const [tracking, setTracking] = useState(van.tracking_status)
  const [loading, setLoading] = useState(false)

  const toggleTracking = async () => {
    setLoading(true)
    const action = tracking === 'live' ? 'stop' : 'start'
    const res = await fetch(`/api/tracking/${van.id}/${action}`, { method: 'POST' })
    if (res.ok) {
      setTracking(action === 'start' ? 'live' : 'offline')
      toast.success(action === 'start' ? 'Tracking started' : 'Tracking stopped')
    } else {
      toast.error('Failed to update tracking status')
    }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div>
          <p className="font-semibold text-gray-900">{van.name}</p>
          <p className="text-sm text-gray-500 capitalize">{van.van_type.replace('_', ' ')}</p>
        </div>
        <TrackingBadge status={tracking} />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggleTracking}
          disabled={loading}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tracking === 'live'
              ? 'bg-red-50 text-red-600 hover:bg-red-100'
              : 'bg-green-50 text-green-600 hover:bg-green-100'
          }`}
        >
          {loading ? '...' : tracking === 'live' ? 'Stop Tracking' : 'Start Tracking'}
        </button>

        <Link
          href={`/dashboard/vans/${van.id}`}
          className="px-4 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100"
        >
          Manage
        </Link>
      </div>
    </div>
  )
}
