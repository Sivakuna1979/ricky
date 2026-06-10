// @ts-nocheck
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { VanSearchBar } from '@/components/van/VanSearchBar'
import { VanMapPublic } from '@/components/map/VanMapPublic'

export const dynamic = 'force-dynamic'

async function geocode(q: string): Promise<{ lat: number; lng: number; display_name: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ', UK')}&limit=1&format=json`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'FoodTaxi/1.0' },
      next: { revalidate: 3600 },
    })
    const data = await res.json()
    if (!data?.length) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display_name: data[0].display_name }
  } catch { return null }
}

export default async function SearchPage({ searchParams }: { searchParams: any }) {
  const postcode = searchParams?.postcode?.trim() ?? ''
  const latParam = parseFloat(searchParams?.lat ?? '')
  const lngParam = parseFloat(searchParams?.lng ?? '')

  let geoLat: number | undefined
  let geoLng: number | undefined
  let label = ''

  if (!isNaN(latParam) && !isNaN(lngParam)) {
    geoLat = latParam; geoLng = lngParam
    label = postcode || 'Your location'
  } else if (postcode) {
    const geo = await geocode(postcode)
    if (geo) { geoLat = geo.lat; geoLng = geo.lng; label = postcode.toUpperCase() }
  }

  const hasSearch = geoLat != null && geoLng != null

  return (
    <>
      <Navbar />
      <main style={{ background: '#080C18', minHeight: '100vh' }}>
        {/* Search hero */}
        <section style={{ background: 'linear-gradient(160deg,#0A0F1E 0%,#080C18 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '48px 16px 32px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              Find Food Vans Near You
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.45)', margin: '0 0 24px' }}>
              Search by postcode or town — see live vans, registered businesses and local food spots on the map.
            </p>
            <VanSearchBar initialPostcode={postcode} />
          </div>
        </section>

        {/* Results */}
        {hasSearch ? (
          <section style={{ padding: '24px 16px', maxWidth: 960, margin: '0 auto' }}>
            {/* Map */}
            <VanMapPublic
              height="520px"
              centerLat={geoLat}
              centerLng={geoLng}
              searchLabel={label}
            />

            {/* Legend explainer */}
            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
              {[
                { color: '#4ade80', label: 'Live FoodTaxi Van' },
                { color: '#f97316', label: 'Registered Business' },
                { color: '#6b7280', label: 'Local Food Place' },
                { color: '#60a5fa', label: 'You Are Here' },
              ].map(({ color, label: l }) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, padding: '5px 12px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', fontWeight: 600 }}>{l}</span>
                </div>
              ))}
            </div>

            {/* No results nudge */}
            <div style={{ marginTop: 24, textAlign: 'center', padding: '20px 16px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 16 }}>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,.4)', margin: '0 0 12px' }}>
                Don't see your local van on FoodTaxi yet?
              </p>
              <a href="/register/business" style={{ display: 'inline-block', padding: '11px 24px', borderRadius: 12, background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 14px rgba(249,115,22,.35)' }}>
                🚐 Register Your Van Free
              </a>
            </div>
          </section>
        ) : (
          <section style={{ padding: '64px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📍</div>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,.4)', marginBottom: 8 }}>Enter a postcode or town above</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.25)' }}>e.g. KT9 2AN, Chessington, Manchester, London</p>
          </section>
        )}
      </main>
      <Footer />
    </>
  )
}
