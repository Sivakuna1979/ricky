import { Suspense } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { VanSearchBar } from '@/components/van/VanSearchBar'
import { VanMapPublic } from '@/components/map/VanMapPublic'
import { FeaturedVans } from '@/components/van/FeaturedVans'

const CATEGORIES = [
  { label: 'Fish & Chips', emoji: '🐟', type: 'fish_and_chips', color: '#1e3a5f', glow: '#3b82f6', tag: 'Most Popular' },
  { label: 'Burger Vans', emoji: '🍔', type: 'burger', color: '#3b1f0a', glow: '#f97316', tag: 'Trending' },
  { label: 'Pizza Vans', emoji: '🍕', type: 'pizza', color: '#3a0d0d', glow: '#ef4444', tag: '' },
  { label: 'Coffee Vans', emoji: '☕', type: 'coffee', color: '#2a1a0a', glow: '#d97706', tag: '' },
  { label: 'Ice Cream', emoji: '🍦', type: 'ice_cream', color: '#1a103a', glow: '#8b5cf6', tag: '' },
  { label: 'Dessert Vans', emoji: '🍰', type: 'dessert', color: '#3a1020', glow: '#ec4899', tag: '' },
  { label: 'Street Food', emoji: '🥙', type: 'street_food', color: '#0d3a2a', glow: '#10b981', tag: 'New' },
  { label: 'Catering', emoji: '🚚', type: 'catering_trailer', color: '#1a1a2e', glow: '#6366f1', tag: '' },
]

const SAMPLE_VANS = [
  { name: "Smith's Fish & Chips", type: 'Fish & Chips', area: 'Manchester City Centre', distance: '0.4 mi', arrival: '5 min', status: 'Open', rating: '4.9', reviews: 128, emoji: '🐟', color: '#1e3a5f', glow: '#3b82f6' },
  { name: 'Blue Sky Burgers', type: 'Burger Van', area: 'Salford Quays', distance: '0.8 mi', arrival: '12 min', status: 'Open', rating: '4.8', reviews: 94, emoji: '🍔', color: '#3b1f0a', glow: '#f97316' },
  { name: 'Bella Italia Street', type: 'Pizza Van', area: 'Didsbury', distance: '1.2 mi', arrival: 'Arriving 12:45', status: 'Arriving', rating: '4.7', reviews: 67, emoji: '🍕', color: '#3a0d0d', glow: '#ef4444' },
]

const STATS = [
  { value: '2,400+', label: 'Active Vans', icon: '🚐', color: '#3b82f6' },
  { value: '18,500', label: 'Orders Today', icon: '📦', color: '#f97316' },
  { value: '180K+', label: 'Customers Served', icon: '👥', color: '#10b981' },
  { value: '1,200+', label: 'Businesses Registered', icon: '🏪', color: '#8b5cf6' },
]

const PRICING = [
  {
    name: 'Starter', price: '£29', period: '/month', color: '#1e3a5f', glow: '#3b82f6', badge: '',
    features: ['1 Van', 'QR Menu', 'GPS Tracking', 'Online Orders', 'Customer Reviews', 'Email Support'],
  },
  {
    name: 'Professional', price: '£79', period: '/month', color: '#2d1b4e', glow: '#8b5cf6', badge: 'Most Popular',
    features: ['Up to 5 Vans', 'Everything in Starter', 'Live Order Dashboard', 'Hygiene Management', 'Analytics & Reports', 'Priority Support', 'Custom Branding'],
  },
  {
    name: 'Enterprise', price: '£199', period: '/month', color: '#1a2d1a', glow: '#10b981', badge: 'Best Value',
    features: ['Unlimited Vans', 'Everything in Pro', 'AI Sales Agent', 'API Access', 'White Label Option', 'Dedicated Account Manager', 'Custom Integrations'],
  },
]

const TESTIMONIALS = [
  { name: 'Dave Thornton', business: "Dave's Fish Bar, Manchester", text: "FoodTaxi has completely transformed my business. Online orders are up 340% and customers love tracking my van in real time.", rating: 5, emoji: '🐟' },
  { name: 'Sarah Mitchell', business: 'Blue Sky Burgers, Salford', text: "The hygiene management tools alone are worth every penny. Everything's digital now — no more paper checklists.", rating: 5, emoji: '🍔' },
  { name: 'Raj Patel', business: 'Spice Route Street Food, Birmingham', text: "Set up took 10 minutes. Within a week I had 50 new regular customers finding me through the app.", rating: 5, emoji: '🥙' },
]

const HOW = [
  { step: '01', title: 'Enter your location', desc: 'Search by postcode or town to instantly see every mobile food van near you, live on the map.', icon: '📍', color: '#3b82f6' },
  { step: '02', title: 'Track in real time', desc: 'See live GPS positions, estimated arrival times, opening hours and menus before you leave.', icon: '🗺️', color: '#f97316' },
  { step: '03', title: 'Order & collect', desc: 'Order ahead online, pay securely, and pick up when ready — no queuing, no waiting.', icon: '🛒', color: '#10b981' },
]

export default function HomePage() {
  return (
    <>
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes pulse-ring { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(1.8);opacity:0} }
        @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
        .float-anim { animation: float 6s ease-in-out infinite; }
        .card-hover { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .card-hover:hover { transform: translateY(-6px); }
        .btn-primary { background: linear-gradient(135deg,#f97316,#ea580c); color:#fff; border:none; cursor:pointer; font-weight:700; transition:all 0.2s; display:inline-block; text-decoration:none; text-align:center; }
        .btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(249,115,22,0.45); }
        .btn-ghost { background:rgba(255,255,255,0.07); color:rgba(255,255,255,0.85); border:1px solid rgba(255,255,255,0.13); cursor:pointer; font-weight:600; transition:all 0.2s; display:inline-block; text-decoration:none; text-align:center; }
        .btn-ghost:hover { background:rgba(255,255,255,0.12); transform:translateY(-1px); }
        .gradient-text { background: linear-gradient(90deg,#f97316,#fbbf24,#f97316); background-size:200% auto; -webkit-background-clip:text; -webkit-text-fill-color:transparent; animation:shimmer 4s linear infinite; }
        .section-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:#f97316; margin-bottom:10px; }
        .glass-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); backdrop-filter:blur(12px); }
      `}</style>

      <Navbar />
      <main style={{ background: '#060914', minHeight: '100vh', overflowX: 'hidden' }}>

        {/* ══════════════════════ HERO ══════════════════════ */}
        <section style={{ position: 'relative', minHeight: '92vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', overflow: 'hidden', background: 'linear-gradient(160deg, #07091A 0%, #0C1230 40%, #07091A 100%)' }}>

          {/* Background grid */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)', backgroundSize: '52px 52px', pointerEvents: 'none' }} />

          {/* Glow orbs */}
          <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle,rgba(249,115,22,0.14) 0%,transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.12) 0%,transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '40%', left: '60%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(59,130,246,0.1) 0%,transparent 60%)', pointerEvents: 'none' }} />

          {/* Floating food emojis */}
          {[
            { e: '🐟', t: '10%', l: '5%', d: '0s' }, { e: '🍔', t: '20%', r: '6%', d: '1.5s' },
            { e: '☕', b: '30%', l: '8%', d: '3s' }, { e: '🍕', b: '25%', r: '5%', d: '2s' },
            { e: '🍦', t: '60%', l: '3%', d: '1s' }, { e: '🥙', t: '55%', r: '4%', d: '2.5s' },
          ].map((f, i) => (
            <div key={i} className="float-anim" style={{ position: 'absolute', fontSize: '2rem', opacity: 0.35, top: f.t, bottom: (f as any).b, left: f.l, right: (f as any).r, animationDelay: f.d, pointerEvents: 'none' }}>{f.e}</div>
          ))}

          <div style={{ position: 'relative', maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>

            {/* Live badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, borderRadius: 9999, padding: '8px 20px', fontSize: 13, fontWeight: 600, marginBottom: 36, background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)' }}>
              <span style={{ position: 'relative', width: 10, height: 10, display: 'inline-block' }}>
                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#4ade80', animation: 'pulse-ring 1.8s ease-out infinite' }} />
                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#4ade80' }} />
              </span>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>247 vans live near you right now</span>
            </div>

            {/* Headline */}
            <h1 style={{ fontSize: 'clamp(2.8rem, 8vw, 5.5rem)', fontWeight: 900, lineHeight: 1.02, letterSpacing: '-0.035em', marginBottom: 28, color: '#fff' }}>
              Find & Order From<br />
              <span className="gradient-text">Mobile Food Vans</span><br />
              Near You
            </h1>

            <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, maxWidth: 580, margin: '0 auto 48px' }}>
              Real-time GPS tracking, online ordering, and live menus from the UK's best mobile food businesses — all in one place.
            </p>

            <VanSearchBar />

            {/* Trust badges */}
            <div style={{ marginTop: 48, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
              {[['⭐', '4.9/5 Rating', '#fbbf24'], ['🚐', '2,400+ Vans', '#3b82f6'], ['📦', 'Free to Use', '#10b981']].map(([icon, text, color]) => (
                <div key={text as string} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1.1rem' }}>{icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: color as string }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════ STATS ══════════════════════ */}
        <section style={{ background: 'rgba(255,255,255,0.025)', borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
            {STATS.map((s, i) => (
              <div key={s.label} style={{ padding: '36px 24px', textAlign: 'center', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>{s.icon}</div>
                <div style={{ fontSize: 'clamp(1.6rem,3vw,2.2rem)', fontWeight: 900, color: s.color, marginBottom: 4, letterSpacing: '-0.02em' }}>{s.value}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════ CATEGORIES ══════════════════════ */}
        <section style={{ padding: '88px 20px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <p className="section-label">Browse by type</p>
              <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 800, color: '#fff', letterSpacing: '-0.025em' }}>What Are You Craving?</h2>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', marginTop: 12 }}>Tap any category to see vans near you</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 16 }}>
              {CATEGORIES.map(cat => (
                <Link key={cat.type} href={`/search?type=${cat.type}`} className="card-hover" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px 24px', borderRadius: 20, textDecoration: 'none', background: `radial-gradient(ellipse at 30% 20%, ${cat.glow}22 0%, ${cat.color} 60%)`, border: `1px solid ${cat.glow}30`, boxShadow: `0 0 30px ${cat.glow}18` }}>
                  {cat.tag && (
                    <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: cat.tag === 'Most Popular' ? '#f97316' : cat.tag === 'Trending' ? '#ef4444' : '#10b981', color: '#fff' }}>{cat.tag}</div>
                  )}
                  <span style={{ fontSize: '2.8rem', marginBottom: 14, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }}>{cat.emoji}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.3 }}>{cat.label}</span>
                  <span style={{ fontSize: 11, color: `${cat.glow}cc`, marginTop: 5, fontWeight: 500 }}>Find vans →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════ LIVE VANS ══════════════════════ */}
        <section style={{ padding: '0 20px 88px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40, flexWrap: 'wrap', gap: 16 }}>
              <div>
                <p className="section-label">Real-time</p>
                <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.5rem)', fontWeight: 800, color: '#fff', letterSpacing: '-0.025em' }}>Vans Live Now</h2>
              </div>
              <Link href="/search" className="btn-ghost" style={{ padding: '11px 24px', borderRadius: 12, fontSize: 14 }}>See all vans →</Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
              {SAMPLE_VANS.map(van => (
                <div key={van.name} className="card-hover glass-card" style={{ borderRadius: 20, overflow: 'hidden', boxShadow: `0 0 40px ${van.glow}15` }}>
                  {/* Van image/header */}
                  <div style={{ height: 160, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `radial-gradient(ellipse at 30% 30%, ${van.glow}35 0%, ${van.color} 70%)` }}>
                    <span style={{ fontSize: '4.5rem', filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.5))' }}>{van.emoji}</span>
                    <div style={{ position: 'absolute', top: 14, left: 14 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: van.status === 'Open' ? 'rgba(16,185,129,0.2)' : 'rgba(234,179,8,0.2)', color: van.status === 'Open' ? '#4ade80' : '#fbbf24', border: `1px solid ${van.status === 'Open' ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.3)'}` }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: van.status === 'Open' ? '#4ade80' : '#fbbf24', display: 'inline-block' }} />
                        {van.status}
                      </span>
                    </div>
                    <div style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>
                      ⭐ {van.rating} ({van.reviews})
                    </div>
                  </div>

                  {/* Van info */}
                  <div style={{ padding: '20px' }}>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: `${van.glow}cc`, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{van.type}</span>
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: 8 }}>{van.name}</h3>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>📍</span> {van.area}
                    </p>

                    {/* Distance & arrival */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                      {[['📏', 'Distance', van.distance], ['⏱️', 'Arrival', van.arrival]].map(([icon, label, val]) => (
                        <div key={label as string} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 12px' }}>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>{icon} {label}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{val}</div>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <Link href={`/search`} className="btn-ghost" style={{ padding: '11px', borderRadius: 11, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        🗺️ Track
                      </Link>
                      <Link href={`/search`} className="btn-primary" style={{ padding: '11px', borderRadius: 11, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        🛒 Order
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════ LIVE MAP ══════════════════════ */}
        <section style={{ padding: '0 20px 88px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <p className="section-label">Live GPS</p>
            <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.5rem)', fontWeight: 800, color: '#fff', marginBottom: 28, letterSpacing: '-0.025em' }}>Van Map</h2>
            <div style={{ borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 0 60px rgba(59,130,246,0.12)' }}>
              <Suspense fallback={<div style={{ height: 480, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🗺️ Loading map...</div>}>
                <VanMapPublic height="480px" />
              </Suspense>
            </div>
          </div>
        </section>

        {/* ══════════════════════ HOW IT WORKS ══════════════════════ */}
        <section id="how-it-works" style={{ padding: '88px 20px', background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <p className="section-label">Simple as that</p>
              <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 800, color: '#fff', letterSpacing: '-0.025em' }}>How FoodTaxi Works</h2>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', marginTop: 12, maxWidth: 500, margin: '12px auto 0' }}>From search to checkout in under 2 minutes</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
              {HOW.map((step, i) => (
                <div key={step.step} className="card-hover glass-card" style={{ borderRadius: 24, padding: '40px 32px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${step.color}, transparent)` }} />
                  <div style={{ width: 72, height: 72, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 24px', background: `${step.color}22`, border: `1px solid ${step.color}44` }}>
                    {step.icon}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: step.color, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>{step.step}</div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 14 }}>{step.title}</h3>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════ POPULAR VANS ══════════════════════ */}
        <section style={{ padding: '88px 20px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40, flexWrap: 'wrap', gap: 16 }}>
              <div>
                <p className="section-label">Top rated</p>
                <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.5rem)', fontWeight: 800, color: '#fff', letterSpacing: '-0.025em' }}>Popular Vans</h2>
              </div>
              <Link href="/search" className="btn-ghost" style={{ padding: '11px 24px', borderRadius: 12, fontSize: 14 }}>See all →</Link>
            </div>
            <Suspense fallback={
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
                {[...Array(3)].map((_, i) => <div key={i} style={{ height: 280, borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }} />)}
              </div>
            }>
              <FeaturedVans />
            </Suspense>
          </div>
        </section>

        {/* ══════════════════════ PRICING ══════════════════════ */}
        <section id="pricing" style={{ padding: '88px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <p className="section-label">Simple pricing</p>
              <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 800, color: '#fff', letterSpacing: '-0.025em' }}>Plans for Every Business</h2>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', marginTop: 12 }}>14-day free trial on all plans. No credit card required.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
              {PRICING.map(plan => (
                <div key={plan.name} className="card-hover" style={{ position: 'relative', borderRadius: 24, padding: '36px 32px', background: `radial-gradient(ellipse at 20% 0%, ${plan.glow}18 0%, ${plan.color} 60%)`, border: plan.badge === 'Most Popular' ? `1.5px solid ${plan.glow}60` : '1px solid rgba(255,255,255,0.08)', boxShadow: plan.badge === 'Most Popular' ? `0 0 60px ${plan.glow}20` : 'none' }}>
                  {plan.badge && (
                    <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: `linear-gradient(135deg,${plan.glow},${plan.glow}cc)`, color: '#fff', fontSize: 11, fontWeight: 800, padding: '5px 18px', borderRadius: 20, whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>{plan.badge}</div>
                  )}
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff', marginBottom: 8 }}>{plan.name}</h3>
                  <div style={{ marginBottom: 28 }}>
                    <span style={{ fontSize: '2.8rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em' }}>{plan.price}</span>
                    <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{plan.period}</span>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 13 }}>
                    {plan.features.map(f => (
                      <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>
                        <span style={{ width: 20, height: 20, borderRadius: '50%', background: `${plan.glow}30`, border: `1px solid ${plan.glow}50`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: plan.glow, flexShrink: 0 }}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/register/business" className="btn-primary" style={{ width: '100%', padding: '14px', borderRadius: 12, fontSize: 15, background: plan.badge === 'Most Popular' ? `linear-gradient(135deg,${plan.glow},${plan.glow}cc)` : 'rgba(255,255,255,0.1)', boxShadow: 'none' }}>
                    Start Free Trial →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════ TESTIMONIALS ══════════════════════ */}
        <section style={{ padding: '88px 20px', background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <p className="section-label">What they say</p>
              <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 800, color: '#fff', letterSpacing: '-0.025em' }}>Loved by Van Owners</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
              {TESTIMONIALS.map(t => (
                <div key={t.name} className="card-hover glass-card" style={{ borderRadius: 24, padding: '32px' }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
                    {[...Array(t.rating)].map((_, i) => <span key={i} style={{ color: '#fbbf24', fontSize: 16 }}>★</span>)}
                  </div>
                  <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, marginBottom: 24, fontStyle: 'italic' }}>"{t.text}"</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>{t.emoji}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{t.business}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════ CTA ══════════════════════ */}
        <section style={{ padding: '96px 20px', position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #0A0F1E 0%, #1a2040 50%, #0A0F1E 100%)' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(249,115,22,0.18) 0%, transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)', backgroundSize: '52px 52px', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 9999, padding: '7px 18px', fontSize: 13, fontWeight: 600, marginBottom: 32, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)', color: '#fb923c' }}>
              🚀 14-day free trial — no credit card required
            </div>
            <h2 style={{ fontSize: 'clamp(2rem,6vw,3.5rem)', fontWeight: 900, color: '#fff', marginBottom: 20, lineHeight: 1.08, letterSpacing: '-0.03em' }}>
              Ready to Grow Your<br />Mobile Food Business?
            </h2>
            <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, maxWidth: 560, margin: '0 auto 48px' }}>
              Join 1,200+ mobile food businesses already using FoodTaxi to get more customers, streamline orders, and manage their entire operation.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
              <Link href="/register/business" className="btn-primary" style={{ padding: '16px 36px', borderRadius: 14, fontSize: '1rem', boxShadow: '0 0 50px rgba(249,115,22,0.4)', letterSpacing: '-0.01em' }}>
                Start Free Trial →
              </Link>
              <Link href="/search" className="btn-ghost" style={{ padding: '16px 36px', borderRadius: 14, fontSize: '1rem' }}>
                Browse Vans
              </Link>
            </div>
            <div style={{ marginTop: 36, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 24 }}>
              {['✓ No setup fees', '✓ Cancel anytime', '✓ UK-based support'].map(t => (
                <span key={t} style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{t}</span>
              ))}
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  )
}
