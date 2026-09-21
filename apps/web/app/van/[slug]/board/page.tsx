// @ts-nocheck
'use client'
// J23-J26 — a public, display-mode menu board for a TV/monitor/tablet
// near the van. Reuses the exact same public /api/van-profile/[slug]
// endpoint the ordering page uses (J24 — "do not create a second menu
// database"): no cost/stock/analytics/staff/admin data ever passes
// through that endpoint, so none can leak here either (J25).
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sortCategories } from '@/lib/categoryOrder'

export default function MenuBoardPage() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<any>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const debounceRef = useRef<any>(null)

  const load = () => {
    fetch(`/api/van-profile/${slug}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setData(d); setLastUpdated(new Date()) })
      .catch(() => {})
  }

  useEffect(() => { load() }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  // J24 — realtime-triggered refresh. The realtime payload itself is
  // never trusted as the source of truth (RLS visibility of a row that
  // just flipped available=false is not guaranteed to arrive as a clean
  // delta) — any event just triggers a real refetch of the authoritative
  // endpoint above, debounced so a burst of edits doesn't hammer it.
  useEffect(() => {
    if (!data?.vans?.[0]?.id) return
    const vanId = data.vans[0].id
    const supabase = createClient()
    const debouncedReload = () => {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(load, 600)
    }
    const channel = supabase.channel(`board-${vanId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items', filter: `van_id=eq.${vanId}` }, debouncedReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vans', filter: `id=eq.${vanId}` }, debouncedReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_deals', filter: `van_id=eq.${vanId}` }, debouncedReload)
      .subscribe()
    // Fallback poll — keeps the board correct even through a realtime
    // disconnect/reconnect (J80's "realtime reconnect" test scenario).
    const poll = setInterval(load, 45000)
    return () => { supabase.removeChannel(channel); clearInterval(poll); clearTimeout(debounceRef.current) }
  }, [data?.vans?.[0]?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window === 'undefined') return
    import('qrcode').then(QRCode => {
      QRCode.toDataURL(`${window.location.origin}/van/${slug}`, { width: 260, margin: 1, color: { dark: '#0a0a14', light: '#ffffff' } })
        .then(setQrDataUrl).catch(() => {})
    })
  }, [slug])

  if (!data) return <div style={{ background: '#080c18', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'system-ui,sans-serif', fontSize: 24 }}>Loading…</div>
  if (!data.business) return <div style={{ background: '#080c18', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'system-ui,sans-serif', fontSize: 24 }}>Van not found</div>

  const { business, vans, menuItems, deals } = data
  const brand = vans?.[0]?.brand
  const primary = brand?.primary ?? '#f97316'
  const secondary = brand?.secondary ?? '#ea580c'
  const allCats = [...new Set((menuItems ?? []).map((i: any) => i.category).filter(Boolean))] as string[]
  const sortedCats = sortCategories(allCats, vans?.[0]?.category_order)
  const byCategory: Record<string, any[]> = {}
  for (const item of menuItems ?? []) {
    const cat = item.category ?? 'Menu'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(item)
  }

  return (
    <div style={{ background: '#0a0a14', minHeight: '100vh', color: '#fff', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Header — branding, kept readable over decorative colour (J26) */}
      <div style={{ background: `linear-gradient(135deg,${primary},${secondary})`, padding: '28px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {brand?.logo ? (
            <img src={brand.logo} alt="" style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover', border: '2px solid rgba(255,255,255,.5)' }} />
          ) : null}
          <div>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>{business.name}</div>
            {(business.city) && <div style={{ fontSize: 15, color: 'rgba(255,255,255,.85)', marginTop: 2 }}>{business.city}</div>}
          </div>
        </div>
        {qrDataUrl && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 12, textAlign: 'center' }}>
            <img src={qrDataUrl} alt="Scan to order" width={110} height={110} />
            <div style={{ fontSize: 12, fontWeight: 800, color: '#111', marginTop: 4 }}>SCAN TO ORDER</div>
          </div>
        )}
      </div>

      {/* Deals strip */}
      {deals?.length > 0 && (
        <div style={{ display: 'flex', gap: 16, padding: '20px 48px', background: 'rgba(255,255,255,.03)', overflowX: 'auto' }}>
          {deals.map((d: any) => (
            <div key={d.id} style={{ background: `${primary}22`, border: `2px solid ${primary}`, borderRadius: 16, padding: '14px 24px', flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: primary, textTransform: 'uppercase', letterSpacing: 1 }}>🔥 Deal</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{d.name}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>£{Number(d.deal_price).toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Menu grid — large, readable, accessibility-first (J26) */}
      <div style={{ flex: 1, padding: '32px 48px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 32 }}>
        {sortedCats.length === 0 && (
          <div style={{ fontSize: 22, color: 'rgba(255,255,255,.4)' }}>Menu coming soon</div>
        )}
        {sortedCats.map(cat => (
          <div key={cat}>
            <div style={{ fontSize: 22, fontWeight: 900, color: primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16, borderBottom: `2px solid ${primary}44`, paddingBottom: 8 }}>{cat}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {byCategory[cat]?.map((item: any) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 19, fontWeight: 700, color: '#fff' }}>{item.name}</div>
                    {item.description && <div style={{ fontSize: 14, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>{item.description}</div>}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap' }}>£{Number(item.price).toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '14px 48px', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,.3)', borderTop: '1px solid rgba(255,255,255,.06)' }}>
        Prices and availability update live · Powered by FoodTaxi{lastUpdated ? ` · updated ${lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}
      </div>
    </div>
  )
}
