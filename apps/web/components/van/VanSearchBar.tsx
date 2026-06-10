'use client'
// @ts-nocheck

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { VAN_TYPES } from '@/lib/utils/constants'

export function VanSearchBar({ initialPostcode = '' }: { initialPostcode?: string }) {
  const router = useRouter()
  const [postcode, setPostcode] = useState(initialPostcode)
  const [type, setType] = useState('')
  const [locating, setLocating] = useState(false)

  const useMyLocation = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        try {
          // Reverse-geocode to a human-readable town name using OpenStreetMap Nominatim
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          )
          const data = await res.json()
          const place =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.county ||
            `${lat.toFixed(4)},${lng.toFixed(4)}`
          setPostcode(place)
          const params = new URLSearchParams()
          params.set('postcode', place)
          params.set('lat', String(lat))
          params.set('lng', String(lng))
          if (type) params.set('type', type)
          router.push(`/search?${params.toString()}`)
        } catch {
          // fallback: use raw coords
          const coords = `${lat.toFixed(4)},${lng.toFixed(4)}`
          setPostcode(coords)
          const params = new URLSearchParams()
          params.set('postcode', coords)
          params.set('lat', String(lat))
          params.set('lng', String(lng))
          if (type) params.set('type', type)
          router.push(`/search?${params.toString()}`)
        } finally {
          setLocating(false)
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

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

        {/* Use my location button */}
        <button
          onClick={useMyLocation}
          disabled={locating}
          title="Use my current location"
          style={{ background: 'none', border: 'none', cursor: locating ? 'wait' : 'pointer', padding: '10px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: locating ? 0.6 : 1 }}
        >
          {locating
            ? <span style={{ fontSize: 18, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
            : <span style={{ fontSize: 20 }} title="Use my location">🎯</span>
          }
        </button>

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

      {/* Use my location link */}
      <div style={{ marginTop: 10, textAlign: 'center' }}>
        <button
          onClick={useMyLocation}
          disabled={locating}
          style={{ background: 'none', border: 'none', cursor: locating ? 'wait' : 'pointer', color: locating ? 'rgba(251,191,36,.5)' : '#fbbf24', fontSize: 13, fontWeight: 700, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          {locating ? '⏳ Finding your location…' : '📍 Use my current location'}
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
