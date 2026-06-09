import Link from 'next/link'

const LINKS = {
  Product: [['Find Vans', '/search'], ['Live Map', '/#map'], ['QR Menu', '/register/business'], ['Online Orders', '/register/business']],
  Business: [['Start Free Trial', '/register/business'], ['Pricing', '/register/business'], ['Van Dashboard', '/dashboard'], ['Hygiene Tools', '/register/business']],
  Company: [['About Us', '/about'], ['Contact', '/contact'], ['Privacy Policy', '/privacy'], ['Terms of Service', '/terms']],
}

export function Footer() {
  return (
    <footer style={{ background: '#04060E', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40 }}>
          <div>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>FT</div>
              <span style={{ fontWeight: 700, color: '#fff', fontSize: '1.125rem' }}>Food<span style={{ color: '#f97316' }}>Taxi</span></span>
            </Link>
            <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 24, color: 'rgba(255,255,255,0.4)' }}>The all-in-one platform for mobile food businesses. Track live, order online, manage compliance.</p>
            <div style={{ display: 'flex', gap: 12 }}>{'🐟🍔☕🍕🍦'.split('').filter(c => c.trim()).map(e => <span key={e} style={{ fontSize: '1.25rem' }}>{e}</span>)}</div>
          </div>
          {Object.entries(LINKS).map(([section, links]) => (
            <div key={section}>
              <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, color: 'rgba(255,255,255,0.3)' }}>{section}</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {links.map(([label, href]) => (
                  <li key={label}><Link href={href} style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 48, paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>© {new Date().getFullYear()} FoodTaxi Ltd. All rights reserved. Built for the UK street food scene 🇬🇧</span>
        </div>
      </div>
    </footer>
  )
}
