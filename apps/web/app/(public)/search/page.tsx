import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { VanSearchBar } from '@/components/van/VanSearchBar'

export default function SearchPage() {
  return (
    <>
      <Navbar />
      <main style={{ background: '#080C18', minHeight: '100vh' }}>
        <section className="py-16 px-4" style={{ background: 'linear-gradient(160deg, #0A0F1E 0%, #080C18 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="font-display text-4xl font-extrabold text-white mb-4">Find Vans Near You</h1>
            <p className="mb-8" style={{ color: 'rgba(255,255,255,0.45)' }}>Search by postcode or town to see mobile food vans in your area.</p>
            <VanSearchBar />
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-7xl mx-auto text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <p className="text-lg">Enter a postcode or town above to find vans near you.</p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
