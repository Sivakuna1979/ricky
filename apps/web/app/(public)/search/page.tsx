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
              Discover ALL food vans and mobile businesses from Google Maps — live results, no registration needed.
            </p>
            <VanSearchBar initialPostcode={postcode} />
          </div>
        </section>

        {/* Results */}
        {hasSearch ? (
          <section style={{ padding: '24px 16px', maxWidth: 1100, margin: '0 auto' }}>
            <VanMapPublic
              height="520px"
              centerLat={geoLat}
              centerLng={geoLng}
              searchLabel={label}
              showCards={true}
            />

            {/* Register nudge */}
            <div style={{ marginTop: 32, textAlign: 'center', padding: '24px 16px', background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)', borderRadius: 16 }}>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,.5)', margin: '0 0 6px' }}>
                Is your van listed but not claimed? Or want to go live with GPS tracking?
              </p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', margin: '0 0 16px' }}>
                Register free to add your menu, accept orders, and appear as a live FoodTaxi van.
              </p>
              <a href="/register/business" style={{ display: 'inline-block', padding: '11px 28px', borderRadius: 12, background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 14px rgba(249,115,22,.35)' }}>
                🚐 Register Your Van Free
              </a>
            </div>
          </section>
        ) : (
          <section style={{ padding: '32px 16px', maxWidth: 1100, margin: '0 auto' }}>
            {/* GPS-only map — loads automatically via watchPosition */}
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', textAlign: 'center', marginBottom: 20 }}>
              📍 Detecting your location — food businesses near you will appear automatically.
            </p>
            <VanMapPublic height="560px" showCards={true} />
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.25)' }}>Or search by postcode or town above — e.g. KT9 2AN, Chessington, Manchester</p>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  )
}
