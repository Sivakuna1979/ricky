import Link from 'next/link'

export function Footer() {
  return (
    <footer style={{ background: 'linear-gradient(180deg, #04060E 0%, #020408 100%)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '72px 20px 40px' }}>

        {/* Top grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 48, marginBottom: 56 }}>

          {/* Brand */}
          <div style={{ gridColumn: 'span 2' }}>
            <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 11, textDecoration: 'none', marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)', boxShadow: '0 4px 14px rgba(249,115,22,0.4)' }}>
                <span style={{ color: '#fff', fontSize: 16, fontWeight: 900 }}>FT</span>
              </div>
              <div>
                <div style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 800 }}>Food<span style={{ color: '#f97316' }}>Taxi</span></div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Mobile Food Finder</div>
              </div>
            </Link>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.4)', maxWidth: 320, marginBottom: 28 }}>
              The UK's leading platform for mobile food businesses. Track live vans, order online, and manage your entire food business from one dashboard.
            </p>

            {/* Social */}
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Facebook', icon: 'f', href: '#', color: '#1877F2' },
                { label: 'Instagram', icon: '◈', href: '#', color: '#E1306C' },
                { label: 'Twitter', icon: '𝕏', href: '#', color: '#fff' },
              ].map(s => (
                <a key={s.label} href={s.href} aria-label={s.label} style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: s.color, textDecoration: 'none', fontSize: 14, fontWeight: 700, transition: 'background 0.2s' }}>{s.icon}</a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', marginBottom: 20 }}>Product</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[['Find Vans', '/search'], ['Live Map', '/#map'], ['Online Ordering', '/register/business'], ['QR Menus', '/register/business'], ['GPS Tracking', '/register/business']].map(([label, href]) => (
                <li key={label}><Link href={href} style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>{label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Business */}
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', marginBottom: 20 }}>Business</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[['Start Free Trial', '/register/business'], ['Pricing', '/#pricing'], ['Van Dashboard', '/dashboard'], ['Hygiene Tools', '/register/business'], ['Analytics', '/register/business']].map(([label, href]) => (
                <li key={label}><Link href={href} style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>{label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', marginBottom: 20 }}>Company</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[['About Us', '/about'], ['Contact', '/contact'], ['Privacy Policy', '/privacy'], ['Terms of Service', '/terms'], ['Cookie Policy', '/cookies']].map(([label, href]) => (
                <li key={label}><Link href={href} style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>{label}</Link></li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>© {new Date().getFullYear()} FoodTaxi Ltd. All rights reserved. Registered in England & Wales.</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {['🐟', '🍔', '☕', '🍕', '🍦', '🥙'].map(e => <span key={e} style={{ fontSize: '1.1rem' }}>{e}</span>)}
          </div>
        </div>
      </div>
    </footer>
  )
}
