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
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'row', gap: 0, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: 6, backdropFilter: 'blur(12px)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px' }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>📍</span>
          <input
            value={postcode}
            onChange={e => setPostcode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Postcode or town..."
            style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 15, fontWeight: 500, width: '100%' }}
          />
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.12)', margin: '8px 0', flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', gap: 8, minWidth: 140 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>🍽️</span>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            style={{ background: 'none', border: 'none', outline: 'none', color: type ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 500, cursor: 'pointer', minWidth: 110 }}
          >
            <option value="" style={{ background: '#0a0f1e' }}>All types</option>
            {VAN_TYPES.map(t => <option key={t.value} value={t.value} style={{ background: '#0a0f1e' }}>{t.label}</option>)}
          </select>
        </div>
        <button
          onClick={search}
          style={{ padding: '13px 28px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15, color: '#fff', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', boxShadow: '0 4px 16px rgba(249,115,22,0.4)', whiteSpace: 'nowrap', transition: 'transform 0.15s, box-shadow 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(249,115,22,0.55)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(249,115,22,0.4)' }}
        >
          Find Vans 🔍
        </button>
      </div>
      <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
        {['🐟 Fish & Chips', '🍔 Burgers', '☕ Coffee', '🍕 Pizza', '🍦 Ice Cream'].map(tag => (
          <button key={tag} onClick={() => { setType(tag.split(' ')[1]?.toLowerCase().replace(' & ', '_and_') || ''); search() }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', fontSize: 12, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', transition: 'background 0.15s' }}>
            {tag}
          </button>
        ))}
      </div>
    </div>
  )
}
