import { Suspense } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { VanSearchBar } from '@/components/van/VanSearchBar'
import { VanMapPublic } from '@/components/map/VanMapPublic'
import { FeaturedVans } from '@/components/van/FeaturedVans'
import { VanTypeGrid } from '@/components/van/VanTypeGrid'

const SCHEDULE_CARDS = [
  { name: "Smith's Fish & Chips", area: 'Manchester City Centre', time: '11:30 – 14:00', status: 'Live Now', statusColor: '#22c55e', bg: 'linear-gradient(135deg, #0A0F1E 0%, #1E2A42 100%)', border: 'rgba(30,80,180,0.35)', emoji: '🐟' },
  { name: 'Blue Sky Burgers', area: 'Salford Quays', time: '12:00 – 15:30', status: 'Live Now', statusColor: '#22c55e', bg: 'linear-gradient(135deg, #0D2137 0%, #1A3A5C 100%)', border: 'rgba(37,99,235,0.35)', emoji: '🍔' },
  { name: 'Green Garden Wraps', area: 'Didsbury', time: '11:00 – 13:30', status: 'Arriving 12:45', statusColor: '#eab308', bg: 'linear-gradient(135deg, #0D2418 0%, #1A4030 100%)', border: 'rgba(21,128,61,0.35)', emoji: '🥙' },
  { name: 'Hot Box BBQ', area: 'Trafford Park', time: '13:00 – 17:00', status: 'Opens Soon', statusColor: '#f97316', bg: 'linear-gradient(135deg, #2A1200 0%, #3D1F00 100%)', border: 'rgba(194,65,12,0.35)', emoji: '🍖' },
]

const HOW_IT_WORKS = [
  { step: '01', title: 'Enter your location', desc: 'Type your postcode or town to instantly see all mobile food vans operating nearby.', icon: '📍' },
  { step: '02', title: 'Track in real time', desc: 'See live GPS positions, estimated arrival times, and trading hours on the map.', icon: '🗺️' },
  { step: '03', title: 'Order & enjoy', desc: 'Browse menus, place orders online or scan the QR code when you arrive.', icon: '🛒' },
]

const STATS = [
  { value: '2,400+', label: 'Registered vans' },
  { value: '180K+', label: 'Monthly customers' },
  { value: '98%', label: 'Uptime SLA' },
  { value: '4.9★', label: 'App store rating' },
]

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main style={{ background: '#080C18', minHeight: '100vh' }}>

        {/* Hero */}
        <section style={{ position: 'relative', color: 'white', padding: '96px 16px 128px', overflow: 'hidden', background: 'linear-gradient(160deg, #0A0F1E 0%, #0E1628 60%, #080C18 100%)' }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
          <div style={{ position: 'absolute', top: 0, left: '25%', width: 600, height: 600, borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 65%)', transform: 'translate(-50%,-40%)' }} />
          <div style={{ position: 'relative', maxWidth: 896, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 9999, padding: '6px 16px', fontSize: 14, marginBottom: 32, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
              <span style={{ color: 'rgba(255,255,255,0.75)' }}>247 vans live near you right now</span>
            </div>
            <h1 className="font-display" style={{ fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', fontWeight: 800, marginBottom: 24, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
              Find Your Favourite<br />
              <span style={{ background: 'linear-gradient(90deg, #f97316, #fb923c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Mobile Food Van</span>
            </h1>
            <p style={{ fontSize: '1.125rem', marginBottom: 40, maxWidth: 480, margin: '0 auto 40px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
              Real-time GPS tracking, online ordering, and live menus — all in one place.
            </p>
            <VanSearchBar />
            <div style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              {['🐟 Fish & Chips', '🍔 Burgers', '☕ Coffee', '🍕 Pizza', '🍦 Ice Cream', '🥙 Street Food'].map(tag => (
                <span key={tag} style={{ fontSize: 13, padding: '6px 12px', borderRadius: 9999, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>{tag}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section style={{ background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth: 896, margin: '0 auto', padding: '32px 16px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
            {STATS.map((s, i) => (
              <div key={s.label} style={{ textAlign: 'center', padding: '8px 0', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
                <div className="font-display" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>{s.value}</div>
                <div style={{ fontSize: 12, marginTop: 4, color: 'rgba(255,255,255,0.35)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Vans Out Today */}
        <section style={{ padding: '56px 16px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#f97316', marginBottom: 8 }}>Live now</p>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>Vans Out Today</h2>
              </div>
              <Link href="/search" style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>View all →</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
              {SCHEDULE_CARDS.map(card => (
                <div key={card.name} style={{ borderRadius: 16, padding: 20, cursor: 'pointer', background: card.bg, border: `1px solid ${card.border}` }}>
                  <div style={{ fontSize: '1.75rem', marginBottom: 16 }}>{card.emoji}</div>
                  <p style={{ color: '#fff', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{card.name}</p>
                  <p style={{ fontSize: 12, marginBottom: 16, color: 'rgba(255,255,255,0.4)' }}>{card.area}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{card.time}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 9999, background: `${card.statusColor}22`, color: card.statusColor, border: `1px solid ${card.statusColor}44` }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: card.statusColor, display: 'inline-block' }} />
                      {card.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Live Map */}
        <section style={{ padding: '56px 16px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#f97316', marginBottom: 8 }}>Real-time</p>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', marginBottom: 24 }}>Live Van Map</h2>
            <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Suspense fallback={<div style={{ height: 440, background: 'rgba(255,255,255,0.04)' }} />}>
                <VanMapPublic height="440px" />
              </Suspense>
            </div>
          </div>
        </section>

        {/* Food Type Grid */}
        <section style={{ padding: '56px 16px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#f97316', marginBottom: 8 }}>Browse by type</p>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', marginBottom: 24 }}>What Are You Craving?</h2>
            <VanTypeGrid />
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" style={{ padding: '80px 16px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ maxWidth: 1024, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#f97316', marginBottom: 12 }}>Simple as that</p>
              <h2 className="font-display" style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', fontWeight: 800, color: '#fff' }}>How FoodTaxi Works</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
              {HOW_IT_WORKS.map(step => (
                <div key={step.step} style={{ borderRadius: 16, padding: 32, textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>{step.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', marginBottom: 12 }}>{step.step}</div>
                  <h3 style={{ color: '#fff', fontWeight: 700, fontSize: '1.125rem', marginBottom: 12 }}>{step.title}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.45)' }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Popular Vans */}
        <section style={{ padding: '56px 16px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#f97316', marginBottom: 8 }}>Top rated</p>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>Popular Vans</h2>
              </div>
              <Link href="/search" style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>See all →</Link>
            </div>
            <Suspense fallback={
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                {[...Array(6)].map((_, i) => <div key={i} style={{ height: 224, borderRadius: 16, background: 'rgba(255,255,255,0.04)' }} />)}
              </div>
            }>
              <FeaturedVans />
            </Suspense>
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: '96px 16px', position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #0A0F1E 0%, #1E2A42 100%)' }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, rgba(249,115,22,0.15) 0%, transparent 60%)' }} />
          <div style={{ position: 'relative', maxWidth: 672, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 9999, padding: '6px 16px', fontSize: 14, marginBottom: 32, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316' }}>
              🚀 14-day free trial — no card required
            </div>
            <h2 className="font-display" style={{ fontSize: 'clamp(2rem, 6vw, 3rem)', fontWeight: 800, color: '#fff', marginBottom: 20, lineHeight: 1.1 }}>
              Own a Mobile<br />Food Business?
            </h2>
            <p style={{ fontSize: '1.125rem', marginBottom: 40, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
              Your own van page, QR code, live GPS tracking, online orders, and food hygiene management — all in one platform.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              <Link href="/register/business" style={{ display: 'inline-block', fontWeight: 700, padding: '16px 32px', borderRadius: 9999, fontSize: '1.125rem', color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', boxShadow: '0 0 40px rgba(249,115,22,0.35)' }}>
                Start Free Trial
              </Link>
              <Link href="/search" style={{ display: 'inline-block', fontWeight: 600, padding: '16px 32px', borderRadius: 9999, fontSize: '1.125rem', textDecoration: 'none', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.12)' }}>
                Browse Vans
              </Link>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  )
}
