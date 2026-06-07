'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { VAN_TYPES } from '@/lib/utils/constants'

export function VanSearchBar() {
  const router = useRouter()
  const [postcode, setPostcode] = useState('')
  const [type, setType] = useState('')

  const search = () => {
    const params = new URLSearchParams()
    if (postcode) params.set('postcode', postcode)
    if (type) params.set('type', type)
    router.push(`/search?${params.toString()}`)
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
      <input
        value={postcode}
        onChange={e => setPostcode(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && search()}
        placeholder="Enter postcode or town..."
        className="flex-1 px-5 py-4 rounded-xl text-gray-900 text-lg focus:outline-none focus:ring-2 focus:ring-white"
      />
      <select
        value={type}
        onChange={e => setType(e.target.value)}
        className="px-4 py-4 rounded-xl text-gray-900 bg-white focus:outline-none"
      >
        <option value="">All types</option>
        {VAN_TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <button
        onClick={search}
        className="px-8 py-4 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
      >
        Search
      </button>
    </div>
  )
}
