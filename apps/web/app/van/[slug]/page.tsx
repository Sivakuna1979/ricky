// @ts-nocheck
export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

const TYPE_EMOJI: Record<string, string> = {
  fish_and_chips: '🐟', burger: '🍔', pizza: '🍕', coffee: '☕',
  ice_cream: '🍦', kebab: '🥙', street_food: '🌮', catering_trailer: '🚐',
  bakery: '🥖', fast_food: '🍟', other: '🍽️',
}

const CAT_ORDER = ['Fish','Chips','Burgers','Chicken','Vegetarian','Sides','Extras','Drinks','Desserts','Specials','Mains','Starters']

export default async function VanProfilePage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()

  // Look up business by slug — no status gate so pending businesses still show
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, slug, business_type, phone, email, website, postcode, city, address')
    .eq('slug', params.slug)
    .maybeSingle()

  if (!business) notFound()

  const { data: vans } = await supabase
    .from('vans')
    .select('id, name, van_type, tracking_status, lat, lng, phone, description')
    .eq('business_id', business.id)

  // Get menu items for all vans of this business
  const vanIds = (vans ?? []).map(v => v.id)
  let menuItems: any[] = []
  if (vanIds.length > 0) {
    const { data: items } = await supabase
      .from('menu_items')
      .select('id, name, description, price, category, available, van_id')
      .in('van_id', vanIds)
      .eq('available', true)
      .order('category')
    menuItems = items ?? []
  }

  // Group by category
  const allCats = [...new Set(menuItems.map(i => i.category).filter(Boolean))]
  const sortedCats = [
    ...CAT_ORDER.filter(c => allCats.includes(c)),
    ...allCats.filter(c => !CAT_ORDER.includes(c)),
  ]
  const byCategory: Record<string, any[]> = {}
  for (const item of menuItems) {
    const cat = item.category ?? 'Other'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(item)
  }

  const emoji = TYPE_EMOJI[business.business_type] ?? '🍽️'
  const anyLive = (vans ?? []).some(v => v.tracking_status === 'live')
  const mapsQuery = encodeURIComponent([business.name, business.city, business.postcode].filter(Boolean).join(' '))
  const phone = business.phone || (vans ?? [])[0]?.phone

  return (
    <div style={{ background:'#080c18', minHeight:'100vh', fontFamily:'system-ui,-apple-system,sans-serif', color:'#fff' }}>
      {/* Header */}
      <div style={{ background:'#0d1427', borderBottom:'1px solid #1e2a45', padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <a href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
          <div style={{ background:'linear-gradient(135deg,#f97316,#ea580c)', borderRadius:8, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:14, color:'#fff' }}>FT</div>
          <span style={{ fontSize:18, fontWeight:800, color:'#fff' }}>FoodTaxi</span>
        </a>
        <a href="/search" style={{ fontSize:13, color:'#f97316', textDecoration:'none', fontWeight:600 }}>← Search</a>
      </div>

      {/* Hero */}
      <div style={{ padding:'36px 20px 20px', textAlign:'center' }}>
        <div style={{ fontSize:64, marginBottom:12, lineHeight:1 }}>{emoji}</div>
        <h1 style={{ fontSize:28, fontWeight:900, margin:'0 0 6px', letterSpacing:-0.5 }}>{business.name}</h1>
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, background: anyLive ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.15)', border:`1px solid ${anyLive ? 'rgba(16,185,129,0.4)' : 'rgba(107,114,128,0.3)'}`, borderRadius:20, padding:'4px 12px', fontSize:12, fontWeight:700, color: anyLive ? '#6ee7b7' : '#9ca3af', marginBottom:10 }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background: anyLive ? '#10b981' : '#4b5563', boxShadow: anyLive ? '0 0 6px #10b981' : 'none' }} />
          {anyLive ? 'Van is Live Now' : 'Currently Offline'}
        </div>
        {(business.city || business.postcode) && (
          <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>📍 {[business.city, business.postcode].filter(Boolean).join(', ')}</div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ padding:'0 20px 20px', display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
        {phone && (
          <a href={`tel:${phone}`} style={{ padding:'12px 20px', background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)', color:'#6ee7b7', borderRadius:12, textDecoration:'none', fontWeight:700, fontSize:14 }}>
            📞 Call to Order
          </a>
        )}
        <a href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noopener noreferrer" style={{ padding:'12px 20px', background:'rgba(249,115,22,0.15)', border:'1px solid rgba(249,115,22,0.3)', color:'#fdba74', borderRadius:12, textDecoration:'none', fontWeight:700, fontSize:14 }}>
          🗺 Directions
        </a>
        {business.website && (
          <a href={business.website} target="_blank" rel="noopener noreferrer" style={{ padding:'12px 20px', background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.3)', color:'#93c5fd', borderRadius:12, textDecoration:'none', fontWeight:700, fontSize:14 }}>
            🌐 Website
          </a>
        )}
      </div>

      {/* Menu */}
      {menuItems.length > 0 ? (
        <div style={{ padding:'0 16px 40px' }}>
          <h2 style={{ fontSize:20, fontWeight:800, color:'#fff', margin:'0 0 16px', padding:'0 4px' }}>Our Menu</h2>
          {sortedCats.map(cat => (
            <div key={cat} style={{ marginBottom:24 }}>
              <div style={{ fontSize:13, fontWeight:800, color:'#f97316', letterSpacing:1, textTransform:'uppercase', marginBottom:10, padding:'0 4px' }}>{cat}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                {byCategory[cat]?.map(item => (
                  <div key={item.id} style={{ background:'#0d1427', borderRadius:10, padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:'#fff' }}>{item.name}</div>
                      {item.description && <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{item.description}</div>}
                    </div>
                    <div style={{ fontWeight:800, fontSize:15, color:'#f97316', flexShrink:0 }}>
                      £{Number(item.price).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Order CTA */}
          {phone && (
            <div style={{ background:'linear-gradient(135deg,rgba(249,115,22,0.15),rgba(234,88,12,0.15))', border:'1px solid rgba(249,115,22,0.3)', borderRadius:16, padding:20, textAlign:'center', marginTop:8 }}>
              <div style={{ fontSize:18, fontWeight:800, color:'#fff', marginBottom:6 }}>Ready to order?</div>
              <div style={{ fontSize:13, color:'#9ca3af', marginBottom:16 }}>Call us to place your order</div>
              <a href={`tel:${phone}`} style={{ display:'inline-block', padding:'14px 32px', background:'linear-gradient(135deg,#f97316,#ea580c)', color:'#fff', borderRadius:14, textDecoration:'none', fontWeight:800, fontSize:16 }}>
                📞 Call {phone}
              </a>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding:'20px 20px 40px', textAlign:'center', color:'#6b7280' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🍽️</div>
          <div style={{ fontSize:15, fontWeight:600 }}>Menu coming soon</div>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding:'20px', textAlign:'center', borderTop:'1px solid #1e2a45' }}>
        <a href="/" style={{ display:'inline-block', padding:'10px 24px', background:'linear-gradient(135deg,#f97316,#ea580c)', color:'#fff', borderRadius:12, textDecoration:'none', fontWeight:700, fontSize:13 }}>
          Powered by FoodTaxi
        </a>
      </div>
    </div>
  )
}
