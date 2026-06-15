// @ts-nocheck
export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'

const BUSINESS_TYPE_EMOJI = {
  fish_and_chips: '🐟',
  burger: '🍔',
  pizza: '🍕',
  coffee: '☕',
  ice_cream: '🍦',
  street_food: '🌮',
  catering_trailer: '🚐',
  other: '🍽️',
}

export default async function VanProfilePage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, slug, business_type, phone, email, website, postcode, city, address, status')
    .eq('slug', params.slug)
    .eq('status', 'approved')
    .single()

  if (!business) {
    return (
      <div style={{ background: '#080c18', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🍽️</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Business Not Found</h1>
        <p style={{ color: '#6b7280', marginBottom: 32 }}>This business profile doesn't exist or isn't approved yet.</p>
        <a href="/" style={{ padding: '12px 24px', background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', borderRadius: 12, textDecoration: 'none', fontWeight: 700 }}>← Back to FoodTaxi</a>
      </div>
    )
  }

  const { data: vans } = await supabase
    .from('vans')
    .select('id, name, van_type, tracking_status, lat, lng')
    .eq('business_id', business.id)

  const emoji = BUSINESS_TYPE_EMOJI[business.business_type] ?? '🍽️'
  const typeLabel = (business.business_type ?? 'other').replace(/_/g, ' ').toUpperCase()
  const locationLine = [business.city, business.postcode].filter(Boolean).join(', ')
  const mapsQuery = encodeURIComponent([business.name, business.city, business.postcode].filter(Boolean).join(' '))

  return (
    <div style={{ background: '#080c18', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff' }}>
      {/* Header bar */}
      <div style={{ background: '#0d1427', borderBottom: '1px solid #1e2a45', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: '#fff', letterSpacing: -0.5 }}>FT</div>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>FoodTaxi</span>
        </a>
      </div>

      {/* Hero section */}
      <div style={{ padding: '40px 20px 24px', textAlign: 'center', borderBottom: '1px solid #1e2a45' }}>
        <div style={{ fontSize: 72, marginBottom: 16, lineHeight: 1 }}>{emoji}</div>
        <h1 style={{ fontSize: 32, fontWeight: 900, margin: '0 0 8px', letterSpacing: -0.5, color: '#fff' }}>{business.name}</h1>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#f97316', letterSpacing: 1.5, marginBottom: 8 }}>{typeLabel}</div>
        {locationLine && (
          <div style={{ fontSize: 14, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <span>📍</span>
            <span>{locationLine}</span>
          </div>
        )}
      </div>

      {/* Info cards */}
      <div style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
        {business.phone && (
          <a href={`tel:${business.phone}`} style={{ padding: '12px 20px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7', borderRadius: 12, textDecoration: 'none', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            📞 Call
          </a>
        )}
        {business.website && (
          <a href={business.website} target="_blank" rel="noopener noreferrer" style={{ padding: '12px 20px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd', borderRadius: 12, textDecoration: 'none', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            🌐 Website
          </a>
        )}
        <a href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noopener noreferrer" style={{ padding: '12px 20px', background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', color: '#fdba74', borderRadius: 12, textDecoration: 'none', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          🗺 Directions
        </a>
      </div>

      {/* Vans section */}
      {vans && vans.length > 0 && (
        <div style={{ padding: '0 20px 24px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 12 }}>Our Vans</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {vans.map(van => (
              <div key={van.id} style={{ background: '#0d1427', border: '1px solid #1e2a45', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: van.tracking_status === 'live' ? '#10b981' : '#374151', flexShrink: 0, boxShadow: van.tracking_status === 'live' ? '0 0 8px #10b981' : 'none' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{van.name}</div>
                  {van.van_type && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{van.van_type.replace(/_/g, ' ')}</div>}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: van.tracking_status === 'live' ? '#10b981' : '#4b5563', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {van.tracking_status === 'live' ? 'Live' : 'Offline'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA + Footer */}
      <div style={{ padding: '24px 20px 40px', textAlign: 'center', borderTop: '1px solid #1e2a45', marginTop: 8 }}>
        <a href="/" style={{ display: 'inline-block', padding: '14px 28px', background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', borderRadius: 14, textDecoration: 'none', fontWeight: 800, fontSize: 15, marginBottom: 24 }}>
          Powered by FoodTaxi
        </a>
        <div style={{ fontSize: 12, color: '#374151' }}>© FoodTaxi</div>
      </div>
    </div>
  )
}
