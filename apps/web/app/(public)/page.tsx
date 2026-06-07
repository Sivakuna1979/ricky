import { Suspense } from 'react'
import { VanSearchBar } from '@/components/van/VanSearchBar'
import { VanMapPublic } from '@/components/map/VanMapPublic'
import { FeaturedVans } from '@/components/van/FeaturedVans'
import { VanTypeGrid } from '@/components/van/VanTypeGrid'

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative bg-brand-500 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            Find Mobile Food Vans Near You
          </h1>
          <p className="text-xl mb-8 text-brand-100">
            Track live locations, order online and never miss your favourite van.
          </p>
          <VanSearchBar />
        </div>
      </section>

      {/* Live Map */}
      <section className="py-8 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">Vans Live Now</h2>
          <Suspense fallback={<div className="h-96 bg-gray-200 rounded-xl animate-pulse" />}>
            <VanMapPublic height="400px" />
          </Suspense>
        </div>
      </section>

      {/* Food Type Grid */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">What Are You Craving?</h2>
          <VanTypeGrid />
        </div>
      </section>

      {/* Featured Vans */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Popular Vans</h2>
          <Suspense fallback={<div className="grid grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-48 bg-gray-200 rounded-xl animate-pulse" />)}</div>}>
            <FeaturedVans />
          </Suspense>
        </div>
      </section>

      {/* CTA for businesses */}
      <section className="py-20 px-4 bg-brand-600 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Own a Mobile Food Business?</h2>
          <p className="text-lg mb-8 text-brand-100">
            Get your own van page, QR code, live tracking, online orders and hygiene management — all in one platform.
          </p>
          <a
            href="/register/business"
            className="inline-block bg-white text-brand-600 font-bold px-8 py-4 rounded-full text-lg hover:bg-brand-50 transition-colors"
          >
            Start Free Trial
          </a>
        </div>
      </section>
    </main>
  )
}
