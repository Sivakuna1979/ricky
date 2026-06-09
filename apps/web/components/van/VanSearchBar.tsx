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
    <div style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>
      {/* Search pill */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 0,
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: 18,
        padding: 6,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        {/* Location input */}
        <div style={{ flex: '1 1 160px', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', minWidth: 0 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>📍</span>
          <input
            value={postcode}
            onChange={e => setPostcode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Postcode or town..."
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: 15,
              fontWeight: 500,
              width: '100%',
              minWidth: 0,
            }}
          />
        </div>

        {/* Divider */}
        <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '8px 0', flexShrink: 0, alignSelf: 'stretch' }} />

        {/* Type select */}
        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 8, minWidth: 130 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>🍽️</span>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              color: type ? '#fff' : 'rgba(255,255,255,0.45)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              minWidth: 100,
              maxWidth: 160,
            }}
          >
            <option value="" style={{ background: '#0a0f1e', color: '#fff' }}>All types</option>
            {VAN_TYPES.map(t => (
              <option key={t.value} value={t.value} style={{ background: '#0a0f1e', color: '#fff' }}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Search button */}
        <button
          onClick={search}
          style={{
            flex: '0 0 auto',
            padding: '13px 28px',
            borderRadius: 13,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 15,
            color: '#fff',
            background: 'linear-gradient(135deg,#f97316 0%,#ea580c 100%)',
            boxShadow: '0 4px 18px rgba(249,115,22,0.4)',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.01em',
          }}
        >
          Find Vans 🔍
        </button>
      </div>

      {/* Quick-filter tags */}
      <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
        {[
          { label: '🐟 Fish & Chips', value: 'fish_and_chips' },
          { label: '🍔 Burgers',      value: 'burger'         },
          { label: '☕ Coffee',       value: 'coffee'         },
          { label: '🍕 Pizza',        value: 'pizza'          },
          { label: '🍦 Ice Cream',    value: 'ice_cream'      },
        ].map(tag => (
          <button
            key={tag.value}
            onClick={() => {
              setType(tag.value)
              const params = new URLSearchParams()
              if (postcode) params.set('postcode', postcode)
              params.set('type', tag.value)
              router.push(`/search?${params.toString()}`)
            }}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.55)',
              fontSize: 12,
              padding: '6px 14px',
              borderRadius: 20,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {tag.label}
          </button>
        ))}
      </div>
    </div>
  )
}
