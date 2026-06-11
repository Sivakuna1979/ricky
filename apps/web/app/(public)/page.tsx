// @ts-nocheck
import { Suspense } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { VanSearchBar } from '@/components/van/VanSearchBar'
import { VanMapPublic } from '@/components/map/VanMapPublic'
import { FeaturedVans } from '@/components/van/FeaturedVans'

export const dynamic = 'force-dynamic'

// ─── static data ───────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: 'Fish & Chips', emoji: '🐟', type: 'fish_and_chips', bg: '#0d1f35', border: '#1e4a7f', glow: '#3b82f6', tag: 'Most Popular' },
  { label: 'Burger Vans',  emoji: '🍔', type: 'burger',         bg: '#1f0f05', border: '#7c3912', glow: '#f97316', tag: 'Trending'     },
  { label: 'Pizza Vans',   emoji: '🍕', type: 'pizza',          bg: '#1e0707', border: '#7f1d1d', glow: '#ef4444', tag: ''             },
  { label: 'Coffee Vans',  emoji: '☕', type: 'coffee',         bg: '#150d05', border: '#78350f', glow: '#d97706', tag: ''             },
  { label: 'Ice Cream',    emoji: '🍦', type: 'ice_cream',      bg: '#0d0820', border: '#4c1d95', glow: '#8b5cf6', tag: ''             },
  { label: 'Dessert Vans', emoji: '🍰', type: 'dessert',        bg: '#1e0810', border: '#831843', glow: '#ec4899', tag: ''             },
  { label: 'Street Food',  emoji: '🥙', type: 'street_food',   bg: '#061f14', border: '#065f46', glow: '#10b981', tag: 'New'          },
  { label: 'Catering',     emoji: '🚚', type: 'catering_trailer', bg: '#0d0d1a', border: '#312e81', glow: '#6366f1', tag: ''          },
]

const VANS = [
  { name: "Smith's Fish & Chips", type: 'Fish & Chips', area: 'Manchester City Centre', distance: '0.4 mi', arrival: '5 min',    status: 'Open',    rating: '4.9', reviews: 128, emoji: '🐟', bg: '#0d1f35', glow: '#3b82f6', dot: '#4ade80', dotBg: 'rgba(16,185,129,0.15)',  dotBorder: 'rgba(74,222,128,0.3)'  },
  { name: 'Blue Sky Burgers',     type: 'Burger Van',   area: 'Salford Quays',          distance: '0.8 mi', arrival: '12 min',   status: 'Open',    rating: '4.8', reviews: 94,  emoji: '🍔', bg: '#1f0f05', glow: '#f97316', dot: '#4ade80', dotBg: 'rgba(16,185,129,0.15)',  dotBorder: 'rgba(74,222,128,0.3)'  },
  { name: 'Bella Italia Street',  type: 'Pizza Van',    area: 'Didsbury',               distance: '1.2 mi', arrival: '12:45',    status: 'Arriving',rating: '4.7', reviews: 67,  emoji: '🍕', bg: '#1e0707', glow: '#ef4444', dot: '#fbbf24', dotBg: 'rgba(234,179,8,0.15)',   dotBorder: 'rgba(251,191,36,0.3)'  },
]

const STATS = [
  { value: '2,400+', label: 'Active Vans',           icon: '🚐', color: '#60a5fa' },
  { value: '18,500', label: 'Orders Today',          icon: '📦', color: '#fb923c' },
  { value: '180K+',  label: 'Customers Served',      icon: '👥', color: '#34d399' },
  { value: '1,200+', label: 'Businesses Registered', icon: '🏪', color: '#a78bfa' },
]

const HOW = [
  { n: '01', title: 'Enter your location',  desc: 'Search by postcode or town to instantly see every mobile food van near you, live on the map.', icon: '📍', color: '#3b82f6' },
  { n: '02', title: 'Track in real time',   desc: 'See live GPS positions, estimated arrival times, opening hours and menus before you leave.',    icon: '🗺️', color: '#f97316' },
  { n: '03', title: 'Order & collect',      desc: 'Order ahead online, pay securely, and pick up when ready — no queuing, no waiting.',             icon: '🛒', color: '#10b981' },
]

const PRICING = [
  { name: 'Starter', price: '£29', period: '/month', highlight: true, badge: '', glow: '#3b82f6', bg: '#07111f', features: ['1 Van', 'QR Menu', 'GPS Tracking', 'Online Orders', 'Customer Reviews', 'Email Support'] },
]

const TESTIMONIALS = [
  { name: 'Dave Thornton',  biz: "Dave's Fish Bar, Manchester",         text: 'FoodTaxi has completely transformed my business. Online orders are up 340% and customers love tracking my van in real time.',  rating: 5, emoji: '🐟' },
  { name: 'Sarah Mitchell', biz: 'Blue Sky Burgers, Salford',           text: 'The hygiene management tools alone are worth every penny. Everything is digital now — no more paper checklists.',              rating: 5, emoji: '🍔' },
  { name: 'Raj Patel',      biz: 'Spice Route Street Food, Birmingham', text: 'Set up took 10 minutes. Within a week I had 50 new regular customers finding me through the app.',                              rating: 5, emoji: '🥙' },
]

// ─── section renderers ─────────────────────────────────────────────────────

function SectionHero() {
  return (
    <section style={{ position:'relative', minHeight:'94vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'100px 20px 80px', overflow:'hidden', background:'linear-gradient(160deg,#070918 0%,#0d1535 45%,#070918 100%)' }}>
      <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.022) 1px,transparent 1px)', backgroundSize:'52px 52px', pointerEvents:'none' }} />
      <div style={{ position:'absolute', top:'-8%', left:'-4%', width:700, height:700, borderRadius:'50%', background:'radial-gradient(circle,rgba(249,115,22,.13) 0%,transparent 65%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'-10%', right:'-4%', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle,rgba(99,102,241,.11) 0%,transparent 65%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', top:'45%', left:'60%', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle,rgba(59,130,246,.09) 0%,transparent 65%)', pointerEvents:'none' }} />
      {(['🐟','🍔','☕','🍕','🍦','🥙'] as const).map((e, i) => {
        const pos = [{ top:'10%',left:'4%' },{ top:'18%',right:'5%' },{ bottom:'28%',left:'7%' },{ bottom:'22%',right:'4%' },{ top:'58%',left:'2%' },{ top:'55%',right:'3%' }][i]
        return <div key={e} className="ft-float" style={{ position:'absolute', fontSize:'2rem', opacity:.3, pointerEvents:'none', animationDelay:`${i*1.1}s`, ...pos }}>{e}</div>
      })}
      <div style={{ position:'relative', maxWidth:860, width:'100%', margin:'0 auto', textAlign:'center' }}>
        <div className="ft-pill-live"><span className="ft-dot" /><span>247 vans live near you right now</span></div>
        <h1 style={{ fontSize:'clamp(2.5rem,7vw,5.2rem)', fontWeight:900, lineHeight:1.03, letterSpacing:'-0.035em', margin:'0 0 28px', color:'#fff' }}>
          Find &amp; Order From<br /><span className="ft-shimmer">Mobile Food Vans</span><br />Near You
        </h1>
        <p style={{ fontSize:'clamp(1rem,2.5vw,1.2rem)', color:'rgba(255,255,255,.55)', lineHeight:1.75, maxWidth:560, margin:'0 auto 48px' }}>
          Real-time GPS tracking, online ordering, and live menus from the UK's best mobile food businesses — all in one place.
        </p>
        <VanSearchBar />
        <div style={{ marginTop:48, display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'center', gap:24 }}>
          {[['⭐','4.9 / 5 Rating','#fbbf24'],['🚐','2,400+ Vans','#60a5fa'],['📦','Free to Use','#34d399']].map(([icon,text,color]) => (
            <div key={text as string} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:'1.1rem' }}>{icon}</span>
              <span style={{ fontSize:14, fontWeight:600, color: color as string }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SectionStats() {
  return (
    <div style={{ background:'rgba(255,255,255,.025)', borderTop:'1px solid rgba(255,255,255,.07)', borderBottom:'1px solid rgba(255,255,255,.07)' }}>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 20px' }}>
        <div className="ft-stats-grid">
          {STATS.map((s, i) => (
            <div key={s.label} className={`ft-stats-item${i<3?' ft-stats-divider':''}`} style={{ padding:'36px 24px', textAlign:'center' }}>
              <div style={{ fontSize:'2rem', marginBottom:8 }}>{s.icon}</div>
              <div style={{ fontSize:'clamp(1.6rem,3vw,2.2rem)', fontWeight:900, color:s.color, letterSpacing:'-0.025em', marginBottom:4 }}>{s.value}</div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,.4)', fontWeight:500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SectionCategories() {
  return (
    <section style={{ padding:'88px 20px' }}>
      <div style={{ maxWidth:1280, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:52 }}>
          <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', color:'#f97316', marginBottom:10 }}>Browse by type</p>
          <h2 style={{ fontSize:'clamp(1.8rem,4vw,2.8rem)', fontWeight:800, color:'#fff', letterSpacing:'-0.025em', margin:'0 0 12px' }}>What Are You Craving?</h2>
          <p style={{ fontSize:15, color:'rgba(255,255,255,.4)', margin:0 }}>Tap any category to see vans near you</p>
        </div>
        <div className="ft-cat-grid">
          {CATEGORIES.map(c => (
            <Link key={c.type} href={`/search?type=${c.type}`} className="ft-card" style={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'28px 12px 22px', borderRadius:18, textDecoration:'none', background:c.bg, border:`1px solid ${c.border}`, boxShadow:`0 0 28px ${c.glow}14` }}>
              {c.tag && <div style={{ position:'absolute', top:9, right:9, fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:20, background:c.tag==='Most Popular'?'#f97316':c.tag==='Trending'?'#ef4444':'#10b981', color:'#fff' }}>{c.tag}</div>}
              <span style={{ fontSize:'2.6rem', marginBottom:12, filter:'drop-shadow(0 4px 8px rgba(0,0,0,.4))' }}>{c.emoji}</span>
              <span style={{ fontSize:13, fontWeight:700, color:'#fff', textAlign:'center', lineHeight:1.3 }}>{c.label}</span>
              <span style={{ fontSize:11, color:c.glow, marginTop:5, fontWeight:500 }}>Find vans →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function SectionVansLive() {
  return (
    <section style={{ padding:'0 20px 88px' }}>
      <div style={{ maxWidth:1280, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:40, flexWrap:'wrap', gap:16 }}>
          <div>
            <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', color:'#f97316', marginBottom:8 }}>Real-time</p>
            <h2 style={{ fontSize:'clamp(1.8rem,4vw,2.5rem)', fontWeight:800, color:'#fff', letterSpacing:'-0.025em', margin:0 }}>Vans Out Today</h2>
          </div>
          <Link href="/search" className="ft-btn-ghost" style={{ padding:'11px 24px', borderRadius:12, fontSize:14 }}>See all vans →</Link>
        </div>
        <div className="ft-van-grid">
          {VANS.map(v => (
            <div key={v.name} className="ft-card" style={{ borderRadius:22, overflow:'hidden', background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.08)', boxShadow:`0 0 40px ${v.glow}12` }}>
              <div style={{ height:158, position:'relative', display:'flex', alignItems:'center', justifyContent:'center', background:`radial-gradient(ellipse at 30% 30%,${v.glow}30 0%,${v.bg} 70%)` }}>
                <span style={{ fontSize:'4.2rem', filter:'drop-shadow(0 8px 16px rgba(0,0,0,.5))' }}>{v.emoji}</span>
                <div style={{ position:'absolute', top:14, left:14 }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 13px', borderRadius:20, fontSize:12, fontWeight:700, background:v.dotBg, color:v.dot, border:`1px solid ${v.dotBorder}` }}>
                    <span style={{ width:7, height:7, borderRadius:'50%', background:v.dot, display:'inline-block' }} />{v.status}
                  </span>
                </div>
                <div style={{ position:'absolute', top:14, right:14, background:'rgba(0,0,0,.55)', backdropFilter:'blur(8px)', borderRadius:9, padding:'4px 10px', fontSize:12, fontWeight:700, color:'#fbbf24' }}>⭐ {v.rating} ({v.reviews})</div>
              </div>
              <div style={{ padding:'20px 20px 22px' }}>
                <p style={{ fontSize:11, fontWeight:700, color:v.glow, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>{v.type}</p>
                <h3 style={{ fontSize:'1.1rem', fontWeight:700, color:'#fff', margin:'0 0 8px' }}>{v.name}</h3>
                <p style={{ fontSize:13, color:'rgba(255,255,255,.4)', margin:'0 0 18px', display:'flex', alignItems:'center', gap:5 }}><span>📍</span>{v.area}</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:18 }}>
                  {[['📏','Distance',v.distance],['⏱️','Arrival',v.arrival]].map(([icon,label,val]) => (
                    <div key={label as string} style={{ background:'rgba(255,255,255,.05)', borderRadius:10, padding:'10px 12px' }}>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', marginBottom:3 }}>{icon} {label}</div>
                      <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <Link href="/search" className="ft-btn-ghost" style={{ padding:'12px', borderRadius:11, fontSize:13 }}>🗺️ Track</Link>
                  <Link href="/search" className="ft-btn-primary" style={{ padding:'12px', borderRadius:11, fontSize:13 }}>🛒 Order</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SectionMap() {
  return (
    <section style={{ padding:'0 20px 88px' }}>
      <div style={{ maxWidth:1280, margin:'0 auto' }}>
        <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', color:'#f97316', marginBottom:8 }}>Live GPS</p>
        <h2 style={{ fontSize:'clamp(1.8rem,4vw,2.5rem)', fontWeight:800, color:'#fff', margin:'0 0 28px', letterSpacing:'-0.025em' }}>Van Map</h2>
        <div style={{ borderRadius:24, overflow:'hidden', border:'1px solid rgba(255,255,255,.08)', boxShadow:'0 0 60px rgba(59,130,246,.1)' }}>
          <Suspense fallback={<div style={{ height:480, background:'rgba(255,255,255,.03)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', color:'rgba(255,255,255,.5)' }}>🗺️ Loading map…</div>}>
            <VanMapPublic height="480px" />
          </Suspense>
        </div>
      </div>
    </section>
  )
}

function SectionHow() {
  return (
    <section id="how-it-works" style={{ padding:'88px 20px', background:'rgba(255,255,255,.015)', borderTop:'1px solid rgba(255,255,255,.06)' }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:64 }}>
          <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', color:'#f97316', marginBottom:10 }}>Simple as that</p>
          <h2 style={{ fontSize:'clamp(1.8rem,4vw,2.8rem)', fontWeight:800, color:'#fff', letterSpacing:'-0.025em', margin:'0 0 12px' }}>How FoodTaxi Works</h2>
          <p style={{ fontSize:15, color:'rgba(255,255,255,.4)', margin:0 }}>From search to checkout in under 2 minutes</p>
        </div>
        <div className="ft-how-grid">
          {HOW.map(h => (
            <div key={h.n} className="ft-card" style={{ borderRadius:24, padding:'40px 32px', textAlign:'center', position:'relative', overflow:'hidden', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${h.color},transparent)` }} />
              <div style={{ width:70, height:70, borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2rem', margin:'0 auto 24px', background:`${h.color}18`, border:`1px solid ${h.color}35` }}>{h.icon}</div>
              <div style={{ fontSize:11, fontWeight:700, color:h.color, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:12 }}>{h.n}</div>
              <h3 style={{ fontSize:'1.2rem', fontWeight:700, color:'#fff', margin:'0 0 14px' }}>{h.title}</h3>
              <p style={{ fontSize:14, color:'rgba(255,255,255,.44)', lineHeight:1.75, margin:0 }}>{h.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SectionPopular() {
  return (
    <section style={{ padding:'88px 20px' }}>
      <div style={{ maxWidth:1280, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:40, flexWrap:'wrap', gap:16 }}>
          <div>
            <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', color:'#f97316', marginBottom:8 }}>Top rated</p>
            <h2 style={{ fontSize:'clamp(1.8rem,4vw,2.5rem)', fontWeight:800, color:'#fff', letterSpacing:'-0.025em', margin:0 }}>Popular Vans</h2>
          </div>
          <Link href="/search" className="ft-btn-ghost" style={{ padding:'11px 24px', borderRadius:12, fontSize:14 }}>See all →</Link>
        </div>
        <Suspense fallback={<div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:20 }}>{[0,1,2].map(i=><div key={i} style={{ height:280, borderRadius:20, background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.06)' }} />)}</div>}>
          <FeaturedVans />
        </Suspense>
      </div>
    </section>
  )
}

function SectionPricing() {
  return (
    <section id="pricing" style={{ padding:'88px 20px', borderTop:'1px solid rgba(255,255,255,.06)' }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:64 }}>
          <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', color:'#f97316', marginBottom:10 }}>Simple pricing</p>
          <h2 style={{ fontSize:'clamp(1.8rem,4vw,2.8rem)', fontWeight:800, color:'#fff', letterSpacing:'-0.025em', margin:'0 0 12px' }}>Plans for Every Business</h2>
          <p style={{ fontSize:15, color:'rgba(255,255,255,.4)', margin:0 }}>14-day free trial on all plans. No credit card required.</p>
        </div>
        <div className="ft-price-grid">
          {PRICING.map(plan => (
            <div key={plan.name} className="ft-card" style={{ position:'relative', borderRadius:24, padding:'36px 30px 34px', background:plan.bg, border:plan.highlight?`1.5px solid ${plan.glow}55`:'1px solid rgba(255,255,255,.08)', boxShadow:plan.highlight?`0 0 60px ${plan.glow}1a`:'none' }}>
              {plan.badge && <div style={{ position:'absolute', top:-14, left:'50%', transform:'translateX(-50%)', background:`linear-gradient(135deg,${plan.glow},${plan.glow}bb)`, color:'#fff', fontSize:11, fontWeight:800, padding:'5px 18px', borderRadius:20, whiteSpace:'nowrap', letterSpacing:'0.05em' }}>{plan.badge}</div>}
              <h3 style={{ fontSize:'1.25rem', fontWeight:700, color:'#fff', margin:'0 0 8px' }}>{plan.name}</h3>
              <div style={{ marginBottom:28 }}>
                <span style={{ fontSize:'2.8rem', fontWeight:900, color:'#fff', letterSpacing:'-0.04em' }}>{plan.price}</span>
                <span style={{ fontSize:15, color:'rgba(255,255,255,.4)', fontWeight:500 }}>{plan.period}</span>
              </div>
              <ul style={{ listStyle:'none', padding:0, margin:'0 0 32px', display:'flex', flexDirection:'column', gap:13 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'rgba(255,255,255,.75)' }}>
                    <span style={{ width:20, height:20, borderRadius:'50%', flexShrink:0, background:`${plan.glow}22`, border:`1px solid ${plan.glow}44`, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11, color:plan.glow }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register/business" className="ft-btn-primary" style={{ width:'100%', padding:'14px', borderRadius:12, fontSize:15, background:plan.highlight?`linear-gradient(135deg,${plan.glow},${plan.glow}bb)`:'rgba(255,255,255,.1)', display:'block' }}>
                Start Free Trial →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SectionTestimonials() {
  return (
    <section style={{ padding:'88px 20px', background:'rgba(255,255,255,.015)', borderTop:'1px solid rgba(255,255,255,.06)' }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:56 }}>
          <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', color:'#f97316', marginBottom:10 }}>What they say</p>
          <h2 style={{ fontSize:'clamp(1.8rem,4vw,2.8rem)', fontWeight:800, color:'#fff', letterSpacing:'-0.025em', margin:0 }}>Loved by Van Owners</h2>
        </div>
        <div className="ft-test-grid">
          {TESTIMONIALS.map(t => (
            <div key={t.name} className="ft-card" style={{ borderRadius:24, padding:'32px', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)' }}>
              <div style={{ display:'flex', gap:3, marginBottom:20 }}>{[0,1,2,3,4].map(i=><span key={i} style={{ color:'#fbbf24', fontSize:16 }}>★</span>)}</div>
              <p style={{ fontSize:15, color:'rgba(255,255,255,.7)', lineHeight:1.75, marginBottom:24, fontStyle:'italic' }}>"{t.text}"</p>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:46, height:46, borderRadius:'50%', background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', flexShrink:0 }}>{t.emoji}</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>{t.name}</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,.38)', marginTop:3 }}>{t.biz}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SectionEvents() {
  const types = [
    { emoji:'🏢', label:'Corporate Events' }, { emoji:'💒', label:'Weddings'        },
    { emoji:'🎂', label:'Birthdays'         }, { emoji:'🎪', label:'Festivals'       },
    { emoji:'🎉', label:'Private Parties'   }, { emoji:'🏟', label:'Sporting Events' },
    { emoji:'🛒', label:'Street Markets'    }, { emoji:'🎓', label:'Graduation'       },
  ]
  return (
    <section id="book-event" style={{ padding:'88px 20px', background:'linear-gradient(160deg,rgba(10,15,30,0.8) 0%,rgba(8,12,24,0.95) 100%)', borderTop:'1px solid rgba(255,255,255,0.06)', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:'-10%', right:'-5%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle,rgba(249,115,22,0.1) 0%,transparent 65%)', pointerEvents:'none' }} />
      <div style={{ maxWidth:1100, margin:'0 auto', position:'relative' }}>
        <div style={{ textAlign:'center', marginBottom:52 }}>
          <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', color:'#f97316', marginBottom:10 }}>Event catering</p>
          <h2 style={{ fontSize:'clamp(1.8rem,4vw,2.8rem)', fontWeight:900, color:'#fff', letterSpacing:'-0.03em', margin:'0 0 16px' }}>
            Book a Food Van for Your Event
          </h2>
          <p style={{ fontSize:16, color:'rgba(255,255,255,0.45)', maxWidth:560, margin:'0 auto 0', lineHeight:1.7 }}>
            From intimate birthday parties to large corporate events and festivals — FoodTaxi matches you with the perfect food van.
          </p>
        </div>

        {/* Event types grid */}
        <div className="ft-cat-grid" style={{ marginBottom:48 }}>
          {types.map(t=>(
            <Link key={t.label} href="/events" className="ft-card" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px 12px 20px', borderRadius:18, textDecoration:'none', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 0 20px rgba(249,115,22,0.04)' }}>
              <span style={{ fontSize:'2.2rem', marginBottom:10, filter:'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }}>{t.emoji}</span>
              <span style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.75)', textAlign:'center', lineHeight:1.3 }}>{t.label}</span>
            </Link>
          ))}
        </div>

        {/* Features + CTA */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:32, alignItems:'center' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {[
              ['✅', 'Free to enquire — no payment upfront'],
              ['🚐', 'Access to 2,400+ vetted food vans across the UK'],
              ['📋', 'Custom menus for any dietary requirement'],
              ['📍', 'Live GPS tracking on your event day'],
              ['24h', 'Response within 24 hours of your request'],
              ['⭐', '200+ events successfully catered'],
            ].map(([icon,text])=>(
              <div key={text} style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'rgba(249,115,22,0.12)', border:'1px solid rgba(249,115,22,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{icon}</div>
                <span style={{ fontSize:14, color:'rgba(255,255,255,0.65)', fontWeight:500 }}>{text}</span>
              </div>
            ))}
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(249,115,22,0.2)', borderRadius:24, padding:'40px 32px', boxShadow:'0 0 60px rgba(249,115,22,0.1)' }}>
              <div style={{ fontSize:48, marginBottom:16 }}>🎪</div>
              <h3 style={{ fontSize:22, fontWeight:800, color:'#fff', margin:'0 0 12px' }}>Ready to Book?</h3>
              <p style={{ fontSize:14, color:'rgba(255,255,255,0.45)', margin:'0 0 28px', lineHeight:1.6 }}>
                Tell us your event details and we'll find the perfect food van for your special occasion.
              </p>
              <Link href="/events" style={{ display:'block', padding:'16px 24px', borderRadius:14, background:'linear-gradient(135deg,#f97316,#ea580c)', color:'#fff', fontWeight:800, fontSize:16, textDecoration:'none', boxShadow:'0 4px 24px rgba(249,115,22,0.4)', marginBottom:12 }}>
                🚐 Book Your Event Van
              </Link>
              <p style={{ fontSize:12, color:'rgba(255,255,255,0.3)', margin:0 }}>Free to enquire · No card required</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media(max-width:700px){
          #book-event div[style*="grid-template-columns:1fr 1fr"]{grid-template-columns:1fr!important}
        }
      `}</style>
    </section>
  )
}

function SectionCTA() {
  return (
    <section style={{ padding:'100px 20px', position:'relative', overflow:'hidden', background:'linear-gradient(135deg,#080e1e 0%,#152040 50%,#080e1e 100%)' }}>
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 50%,rgba(249,115,22,.16) 0%,transparent 60%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.022) 1px,transparent 1px)', backgroundSize:'52px 52px', pointerEvents:'none' }} />
      <div style={{ position:'relative', maxWidth:720, margin:'0 auto', textAlign:'center' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, borderRadius:9999, padding:'7px 18px', fontSize:13, fontWeight:600, marginBottom:32, background:'rgba(249,115,22,.1)', border:'1px solid rgba(249,115,22,.28)', color:'#fb923c' }}>🚀 14-day free trial — no credit card required</div>
        <h2 style={{ fontSize:'clamp(2rem,6vw,3.5rem)', fontWeight:900, color:'#fff', margin:'0 0 20px', lineHeight:1.08, letterSpacing:'-0.03em' }}>Ready to Grow Your<br />Mobile Food Business?</h2>
        <p style={{ fontSize:'1.1rem', color:'rgba(255,255,255,.5)', lineHeight:1.75, maxWidth:540, margin:'0 auto 48px' }}>Join 1,200+ mobile food businesses already using FoodTaxi to get more customers, streamline orders, and manage their entire operation.</p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:16, justifyContent:'center' }}>
          <Link href="/register/business" className="ft-btn-primary" style={{ padding:'16px 36px', borderRadius:14, fontSize:'1rem', boxShadow:'0 0 50px rgba(249,115,22,.35)', letterSpacing:'-0.01em' }}>Start Free Trial →</Link>
          <Link href="/search" className="ft-btn-ghost" style={{ padding:'16px 36px', borderRadius:14, fontSize:'1rem' }}>Browse Vans</Link>
        </div>
        <div style={{ marginTop:36, display:'flex', flexWrap:'wrap', justifyContent:'center', gap:28 }}>
          {['✓ No setup fees','✓ Cancel anytime','✓ UK-based support'].map(txt=>(
            <span key={txt} style={{ fontSize:13, color:'rgba(255,255,255,.38)', fontWeight:500 }}>{txt}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

const SECTION_MAP: Record<string, () => any> = {
  hero:         SectionHero,
  stats:        SectionStats,
  categories:   SectionCategories,
  vans_live:    SectionVansLive,
  map:          SectionMap,
  how:          SectionHow,
  popular:      SectionPopular,
  events:       SectionEvents,
  pricing:      SectionPricing,
  testimonials: SectionTestimonials,
  cta:          SectionCTA,
}

const DEFAULT_ORDER = ['hero','stats','categories','vans_live','map','how','popular','events','pricing','testimonials','cta']

// ─── page ──────────────────────────────────────────────────────────────────

export default async function HomePage() {
  // Fetch section config from DB; fall back to default order if unavailable
  let sectionConfig = DEFAULT_ORDER.map((key, i) => ({ key, position: i + 1, visible: true }))
  try {
    const { createAdminClient } = await import('@/lib/supabase/server')
    const supabase = await createAdminClient()
    const { data } = await supabase.from('homepage_sections').select('key,position,visible').order('position')
    if (data?.length) sectionConfig = data
  } catch {
    // use defaults
  }

  const orderedSections = sectionConfig
    .filter(s => s.visible)
    .sort((a, b) => a.position - b.position)

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box}
        body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
        @keyframes ft-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
        @keyframes ft-pulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(2);opacity:0}}
        @keyframes ft-shimmer{0%{background-position:200% center}100%{background-position:-200% center}}
        .ft-float{animation:ft-float 7s ease-in-out infinite}
        .ft-shimmer{background:linear-gradient(90deg,#f97316,#fbbf24,#ea580c,#f97316);background-size:300% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:ft-shimmer 5s linear infinite}
        .ft-card{transition:transform .25s ease,box-shadow .25s ease}
        .ft-card:hover{transform:translateY(-6px)}
        .ft-btn-primary{background:linear-gradient(135deg,#f97316 0%,#dc2626 100%);color:#fff;border:none;cursor:pointer;font-weight:700;text-decoration:none;text-align:center;display:inline-block;transition:transform .2s,box-shadow .2s}
        .ft-btn-primary:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(249,115,22,.5)}
        .ft-btn-ghost{background:rgba(255,255,255,.07);color:rgba(255,255,255,.85);border:1px solid rgba(255,255,255,.15);cursor:pointer;font-weight:600;text-decoration:none;text-align:center;display:inline-block;transition:background .2s,transform .2s}
        .ft-btn-ghost:hover{background:rgba(255,255,255,.13);transform:translateY(-1px)}
        .ft-pill-live{display:inline-flex;align-items:center;gap:10px;border-radius:9999px;padding:8px 20px;font-size:13px;font-weight:600;background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.28);color:rgba(255,255,255,.8);margin-bottom:36px}
        .ft-dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:#4ade80;position:relative}
        .ft-dot::before{content:'';position:absolute;inset:0;border-radius:50%;background:#4ade80;animation:ft-pulse 1.8s ease-out infinite}
        .ft-stats-grid{display:grid;grid-template-columns:repeat(4,1fr)}
        .ft-stats-divider{border-right:1px solid rgba(255,255,255,.07)}
        .ft-cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:14px}
        .ft-van-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px}
        .ft-how-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px}
        .ft-price-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}
        .ft-test-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}
        @media(max-width:700px){
          .ft-stats-grid{grid-template-columns:repeat(2,1fr)}
          .ft-stats-divider:nth-child(2){border-right:none}
          .ft-stats-item{border-bottom:1px solid rgba(255,255,255,.07)}
          .ft-cat-grid{grid-template-columns:repeat(2,1fr)}
        }
        @media(max-width:480px){
          .ft-stats-grid{grid-template-columns:1fr}
          .ft-stats-divider{border-right:none}
          .ft-van-grid{grid-template-columns:1fr}
          .ft-cat-grid{grid-template-columns:repeat(2,1fr)}
        }
      `}</style>
      <Navbar />
      <main style={{ background:'#060914', minHeight:'100vh', overflowX:'hidden', color:'#fff' }}>
        {orderedSections.map(({ key }) => {
          const Component = SECTION_MAP[key]
          return Component ? <Component key={key} /> : null
        })}
      </main>
      <Footer />
    </>
  )
}
