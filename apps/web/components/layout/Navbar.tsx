'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const NAV_LINKS = [
  { label: 'Home',         href: '/'                 },
  { label: 'Find Vans',    href: '/search'            },
  { label: 'Book Event',   href: '/events'            },
  { label: 'For Business', href: '/register/business' },
]

export function Navbar() {
  const [open, setOpen]       = useState(false)
  const [role, setRole]       = useState<string | null>(null)
  const [userEmail, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setEmail(user.email ?? null)
      const { data } = await supabase.from('users').select('role').eq('auth_id', user.id).single()
      setRole(data?.role ?? null)
    })
  }, [])

  const isAdmin = role === 'super_admin' || role === 'admin' || userEmail === 'sivakuna@icloud.com'

  return (
    <>
      <style>{`
        .ft-nav-link{color:rgba(255,255,255,.62);text-decoration:none;font-size:14px;font-weight:500;transition:color .18s;padding:4px 0}
        .ft-nav-link:hover{color:#fff}
        .ft-nav-cta{background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;padding:9px 20px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;transition:opacity .18s,transform .18s;display:inline-block}
        .ft-nav-cta:hover{opacity:.88;transform:translateY(-1px)}
        .ft-nav-sign{color:rgba(255,255,255,.62);font-size:14px;font-weight:500;text-decoration:none;padding:8px 14px;transition:color .18s;display:inline-block}
        .ft-nav-sign:hover{color:#fff}
        @media(max-width:768px){.ft-nav-desktop{display:none!important}}
        @media(min-width:769px){.ft-nav-mobile{display:none!important}}
      `}</style>

      <header style={{ position:'relative', zIndex:100, background:'rgba(6,9,20,0.92)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ maxWidth:1280, margin:'0 auto', padding:'0 20px', height:68, display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>

          {/* Logo */}
          <Link href="/" style={{ display:'flex', alignItems:'center', gap:11, textDecoration:'none', flexShrink:0 }}>
            <div style={{ width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#f97316 0%,#dc2626 100%)', boxShadow:'0 4px 14px rgba(249,115,22,0.4)', flexShrink:0 }}>
              <span style={{ color:'#fff', fontSize:15, fontWeight:900, letterSpacing:'-0.5px' }}>FT</span>
            </div>
            <div style={{ lineHeight:1 }}>
              <div style={{ fontSize:'1.05rem', fontWeight:800, letterSpacing:'-0.03em' }}>
                <span style={{ color:'#fff' }}>Food</span>
                <span style={{ color:'#f97316' }}>Taxi</span>
              </div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.33)', letterSpacing:'0.08em', textTransform:'uppercase', marginTop:2 }}>Mobile Food Finder</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="ft-nav-desktop" style={{ display:'flex', alignItems:'center', gap:28, flex:1, justifyContent:'center' }}>
            {NAV_LINKS.map(l => (
              <Link key={l.label} href={l.href} className="ft-nav-link">{l.label}</Link>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="ft-nav-desktop" style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            {isAdmin ? (
              <Link href="/admin/dashboard" style={{ display:'flex', alignItems:'center', gap:7, background:'linear-gradient(135deg,#fbbf24,#f59e0b)', color:'#0a0a14', padding:'9px 18px', borderRadius:10, fontSize:14, fontWeight:800, textDecoration:'none' }}>
                ⚡ Admin Dashboard
              </Link>
            ) : userEmail ? (
              <Link href="/dashboard" className="ft-nav-sign">My Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="ft-nav-sign">Sign in</Link>
                <Link href="/register/business" className="ft-nav-cta">Start Free Trial</Link>
              </>
            )}
          </div>

          {/* Hamburger */}
          <button className="ft-nav-mobile" onClick={() => setOpen(v => !v)} aria-label="Toggle menu"
            style={{ background:'none', border:'none', cursor:'pointer', display:'flex', flexDirection:'column', gap:5, padding:6, flexShrink:0 }}>
            {[0,1,2].map(i => (
              <span key={i} style={{ display:'block', width:22, height:2, background:'rgba(255,255,255,0.8)', borderRadius:2 }} />
            ))}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="ft-nav-mobile" style={{ borderTop:'1px solid rgba(255,255,255,0.07)', background:'rgba(6,9,20,0.98)', padding:'14px 20px 22px', display:'flex', flexDirection:'column', gap:2 }}>
            {NAV_LINKS.map(l => (
              <Link key={l.label} href={l.href} onClick={() => setOpen(false)} style={{ color:'rgba(255,255,255,0.72)', textDecoration:'none', fontSize:15, fontWeight:500, padding:'12px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'block' }}>
                {l.label}
              </Link>
            ))}
            {isAdmin ? (
              <Link href="/admin/dashboard" onClick={() => setOpen(false)} style={{ marginTop:10, display:'block', textAlign:'center', padding:'14px', borderRadius:12, background:'linear-gradient(135deg,#fbbf24,#f59e0b)', color:'#0a0a14', fontWeight:800, textDecoration:'none', fontSize:15 }}>
                ⚡ Admin Dashboard
              </Link>
            ) : userEmail ? (
              <Link href="/dashboard" onClick={() => setOpen(false)} style={{ marginTop:10, display:'block', textAlign:'center', padding:'14px', borderRadius:12, background:'linear-gradient(135deg,#f97316,#ea580c)', color:'#fff', fontWeight:700, textDecoration:'none', fontSize:15 }}>
                My Dashboard →
              </Link>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)} style={{ color:'rgba(255,255,255,0.72)', textDecoration:'none', fontSize:15, fontWeight:500, padding:'12px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'block' }}>
                  Sign in
                </Link>
                <Link href="/register/business" onClick={() => setOpen(false)} style={{ marginTop:10, display:'block', textAlign:'center', padding:'14px', borderRadius:12, background:'linear-gradient(135deg,#f97316,#ea580c)', color:'#fff', fontWeight:700, textDecoration:'none', fontSize:15 }}>
                  Start Free Trial →
                </Link>
              </>
            )}
          </div>
        )}
      </header>
    </>
  )
}
