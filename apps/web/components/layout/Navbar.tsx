'use client'

import { useState } from 'react'
import Link from 'next/link'

export function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <style>{`
        .nav-link { color: rgba(255,255,255,0.65); text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; }
        .nav-link:hover { color: #fff; }
        .nav-cta { background: linear-gradient(135deg, #f97316, #ea580c); color: #fff; padding: 9px 20px; border-radius: 10px; font-size: 14px; font-weight: 700; text-decoration: none; transition: opacity 0.2s, transform 0.2s; display: inline-block; }
        .nav-cta:hover { opacity: 0.9; transform: translateY(-1px); }
        .hamburger-line { display: block; width: 22px; height: 2px; background: rgba(255,255,255,0.8); border-radius: 2px; transition: all 0.2s; }
        @media (max-width: 768px) { .nav-desktop { display: none !important; } .nav-hamburger { display: flex !important; } }
        @media (min-width: 769px) { .nav-hamburger { display: none !important; } .nav-mobile-menu { display: none !important; } }
      `}</style>
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(6,9,20,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)', boxShadow: '0 4px 14px rgba(249,115,22,0.4)', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontSize: 15, fontWeight: 900, letterSpacing: '-0.5px' }}>FT</span>
            </div>
            <div style={{ lineHeight: 1 }}>
              <span style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Food</span>
              <span style={{ color: '#f97316', fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Taxi</span>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 1 }}>Mobile Food Finder</div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <Link href="/search" className="nav-link">Find Vans</Link>
            <Link href="/#how-it-works" className="nav-link">How It Works</Link>
            <Link href="/#pricing" className="nav-link">Pricing</Link>
            <Link href="/register/business" className="nav-link">For Business</Link>
          </nav>

          {/* Desktop CTAs */}
          <div className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/login" style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: 500, textDecoration: 'none', padding: '8px 14px' }}>Sign in</Link>
            <Link href="/register/business" className="nav-cta">Start Free Trial</Link>
          </div>

          {/* Hamburger */}
          <button className="nav-hamburger" onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5, padding: 4 }}>
            <span className="hamburger-line" />
            <span className="hamburger-line" />
            <span className="hamburger-line" />
          </button>
        </div>

        {/* Mobile Menu */}
        {open && (
          <div className="nav-mobile-menu" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(6,9,20,0.98)', padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[['Find Vans', '/search'], ['How It Works', '/#how-it-works'], ['Pricing', '/#pricing'], ['For Business', '/register/business'], ['Sign in', '/login']].map(([label, href]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 15, fontWeight: 500, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{label}</Link>
            ))}
            <Link href="/register/business" onClick={() => setOpen(false)} style={{ marginTop: 8, display: 'block', textAlign: 'center', padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: 15 }}>Start Free Trial →</Link>
          </div>
        )}
      </header>
    </>
  )
}
