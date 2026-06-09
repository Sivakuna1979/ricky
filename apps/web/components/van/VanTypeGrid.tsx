import Link from 'next/link'
import { VAN_TYPES } from '@/lib/utils/constants'

const TYPE_CONFIG: Record<string, { emoji: string; color: string; glow: string }> = {
  fish_and_chips:   { emoji: '🐟', color: '#1E3A5F', glow: 'rgba(37,99,235,0.2)' },
  burger:           { emoji: '🍔', color: '#3B1F0A', glow: 'rgba(249,115,22,0.2)' },
  coffee:           { emoji: '☕', color: '#2A1A0A', glow: 'rgba(180,83,9,0.2)' },
  ice_cream:        { emoji: '🍦', color: '#1A103A', glow: 'rgba(139,92,246,0.2)' },
  pizza:            { emoji: '🍕', color: '#3A0D0D', glow: 'rgba(220,38,38,0.2)' },
  dessert:          { emoji: '🍰', color: '#3A1020', glow: 'rgba(236,72,153,0.2)' },
  street_food:      { emoji: '🍜', color: '#0D3A2A', glow: 'rgba(16,185,129,0.2)' },
  catering_trailer: { emoji: '🚚', color: '#1A1A2E', glow: 'rgba(99,102,241,0.2)' },
  other:            { emoji: '🚐', color: '#1A1A1A', glow: 'rgba(107,114,128,0.2)' },
}

export function VanTypeGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '14px' }}>
      {VAN_TYPES.map(t => {
        const cfg = TYPE_CONFIG[t.value] ?? { emoji: '🚐', color: '#1A1A1A', glow: 'rgba(107,114,128,0.2)' }
        return (
          <Link
            key={t.value}
            href={`/search?type=${t.value}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 16px',
              borderRadius: '16px',
              background: cfg.color,
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: `0 0 24px ${cfg.glow}`,
              textDecoration: 'none',
              transition: 'transform 0.15s ease',
            }}
          >
            <span style={{ fontSize: '2rem', marginBottom: '10px', display: 'block' }}>{cfg.emoji}</span>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>{t.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
