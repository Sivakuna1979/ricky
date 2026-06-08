import { Suspense } from 'react'
import { VanSearchBar } from '@/components/van/VanSearchBar'
import { VanMapPublic } from '@/components/map/VanMapPublic'
import { FeaturedVans } from '@/components/van/FeaturedVans'
import { VanTypeGrid } from '@/components/van/VanTypeGrid'

const SCHEDULE_CARDS = [
  {
    name: "Smith's Fish & Chips",
    area: 'Manchester City Centre',
    time: '11:30 – 14:00',
    status: 'Live Now',
    bg: 'from-[#0A0F1E] to-[#1E2A42]',
    pill: 'bg-green-500',
    border: 'border-blue-800/40',
    emoji: '🐟',
  },
  {
    name: 'Blue Sky Burgers',
    area: 'Salford Quays',
    time: '12:00 – 15:30',
    status: 'Live Now',
    bg: 'from-[#0D2137] to-[#1A3A5C]',
    pill: 'bg-green-500',
    border: 'border-blue-600/40',
    emoji: '🍔',
  },
  {
    name: 'Green Garden Wraps',
    area: 'Didsbury',
    time: '11:00 – 13:30',
    status: 'Arriving 12:45',
    bg: 'from-[#0D2418] to-[#1A4030]',
    pill: 'bg-yellow-400',
    border: 'border-green-700/40',
    emoji: '🥙',
  },
  {
    name: 'Hot Box BBQ',
    area: 'Trafford Park',
    time: '13:00 – 17:00',
    status: 'Opens Soon',
    bg: 'from-[#2A1200] to-[#3D1F00]',
    pill: 'bg-orange-400',
    border: 'border-orange-700/40',
    emoji: '🍖',
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen">

      {/* Hero — dark navy gradient */}
      <section
        className="relative text-white py-24 px-4 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0A0F1E 0%, #1E2A42 100%)' }}
      >
        {/* subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        {/* glow orbs */}
        <div className="absolute top-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-60px] right-[-60px] w-[300px] h-[300px] rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm mb-6 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/80">Live vans near you right now</span>
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-extrabold mb-5 leading-tight tracking-tight">
            Find{' '}
            <span style={{ color: '#f97316' }}>Mobile Food</span>
            <br />
            Vans Near You
          </h1>

          <p className="text-lg md:text-xl mb-10 text-white/60 max-w-2xl mx-auto leading-relaxed">
            Track live locations, order online and never miss your favourite van again.
          </p>

          <VanSearchBar />

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-white/40">
            <span>🐟 Fish &amp; Chips</span>
            <span>🍔 Burgers</span>
            <span>☕ Coffee</span>
            <span>🍕 Pizza</span>
            <span>🍦 Ice Cream</span>
          </div>
        </div>
      </section>

      {/* Schedule bar — coloured van cards */}
      <section style={{ background: '#080C18' }} className="py-8 px-4 border-b border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold text-sm uppercase tracking-widest opacity-60">Vans Out Today</h2>
            <a href="/vans" className="text-sm font-medium" style={{ color: '#f97316' }}>View all →</a>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SCHEDULE_CARDS.map((card) => (
              <div
                key={card.name}
                className={`relative rounded-2xl p-4 bg-gradient-to-br ${card.bg} border ${card.border} overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform`}
              >
                <div className="text-2xl mb-3">{card.emoji}</div>
                <p className="text-white font-semibold text-sm leading-snug mb-1">{card.name}</p>
                <p className="text-white/50 text-xs mb-3">{card.area}</p>
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <span className="text-white/40 text-xs">{card.time}</span>
                  <span className={`inline-flex items-center gap-1 ${card.pill} text-white text-xs font-semibold px-2 py-0.5 rounded-full`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                    {card.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Map */}
      <section className="py-10 px-4 bg-gray-50">
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
      <section
        className="py-20 px-4 text-white text-center"
        style={{ background: 'linear-gradient(135deg, #0A0F1E 0%, #1E2A42 100%)' }}
      >
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-4xl font-extrabold mb-4">Own a Mobile Food Business?</h2>
          <p className="text-lg mb-8 text-white/60">
            Get your own van page, QR code, live tracking, online orders and hygiene management — all in one platform.
          </p>
          <a
            href="/register/business"
            className="inline-block font-bold px-8 py-4 rounded-full text-lg transition-all hover:scale-105 hover:shadow-xl text-white"
            style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}
          >
            Start Free Trial
          </a>
        </div>
      </section>

    </main>
  )
}
