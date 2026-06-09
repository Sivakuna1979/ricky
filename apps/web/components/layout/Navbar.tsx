'use client'

import { useState } from 'react'
import Link from 'next/link'

export function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(8,12,24,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 16px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>FT</div>
          <span style={{ fontWeight: 700, color: '#fff', fontSize: '1.125rem', letterSpacing: '-0.02em' }}>Food<span style={{ color: '#f97316' }}>Taxi</span></span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }} className="hidden-mobile">
          {[['Find Vans', '/search'], ['How It Works', '/#how-it-works'], ['For Businesses', '/register/business']].map(([label, href]) => (
            <Link key={href} href={href} style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>{label}</Link>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="hidden-mobile">
          <Link href="/login" style={{ fontSize: 14, fontWeight: 500, padding: '8px 16px', borderRadius: 8, color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>Sign in</Link>
          <Link href="/register/business" style={{ fontSize: 14, fontWeight: 700, padding: '8px 16px', borderRadius: 8, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>Start Free Trial</Link>
        </div>
      </div>

      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[['Find Vans', '/search'], ['How It Works', '/#how-it-works'], ['For Businesses', '/register/business'], ['Sign in', '/login']].map(([label, href]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} style={{ fontSize: 14, fontWeight: 500, padding: '8px 0', color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>{label}</Link>
          ))}
          <Link href="/register/business" onClick={() => setOpen(false)} style={{ fontSize: 14, fontWeight: 700, padding: '12px 16px', borderRadius: 8, color: '#fff', textDecoration: 'none', textAlign: 'center', background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>Start Free Trial</Link>
        </div>
      )}
    </header>
  )
}
