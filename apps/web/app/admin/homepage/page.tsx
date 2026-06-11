// @ts-nocheck
import { HomepageEditor } from './HomepageEditor'

export const dynamic = 'force-dynamic'

const DEFAULT_SECTIONS = [
  { key: 'hero',         title: 'Hero Banner',    position: 1,  visible: true },
  { key: 'stats',        title: 'Stats Bar',       position: 2,  visible: true },
  { key: 'categories',   title: 'Food Categories', position: 3,  visible: true },
  { key: 'vans_live',    title: 'Vans Out Today',  position: 4,  visible: true },
  { key: 'map',          title: 'Live Map',        position: 5,  visible: true },
  { key: 'how',          title: 'How It Works',    position: 6,  visible: true },
  { key: 'popular',      title: 'Popular Vans',    position: 7,  visible: true },
  { key: 'events',       title: 'Event Catering',  position: 8,  visible: true },
  { key: 'pricing',      title: 'Pricing Plans',   position: 9,  visible: true },
  { key: 'testimonials', title: 'Testimonials',    position: 10, visible: true },
  { key: 'cta',          title: 'Call to Action',  position: 11, visible: true },
]

async function getSections() {
  return DEFAULT_SECTIONS
}

const NAV = [
  { label: 'Dashboard',  icon: '📊', href: '/admin/dashboard' },
  { label: 'Homepage',   icon: '🏠', href: '/admin/homepage'  },
  { label: 'Users',      icon: '👥', href: '/admin/users'     },
  { label: 'Businesses', icon: '🚐', href: '/admin/businesses'},
  { label: 'Orders',     icon: '📦', href: '/admin/orders'    },
  { label: 'Settings',   icon: '⚙️', href: '/admin/settings'  },
]

export default async function AdminHomepagePage() {
  const sections = await getSections()

  return (
    <>
      <style>{`
        html,body{margin:0;padding:0}
        .adm-wrap{display:flex;flex-direction:column;min-height:100vh;background:#070b14;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
        .adm-sidebar{width:200px;flex-shrink:0;background:rgba(255,255,255,.02);border-right:1px solid rgba(255,255,255,.06);padding:20px 10px}
        .adm-bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:#0d1117;border-top:1px solid rgba(255,255,255,.08);z-index:50;padding:8px 0 20px}
        .adm-main{flex:1;padding:24px;overflow-x:hidden}
        .adm-body{display:flex;flex:1}
        @media(max-width:640px){
          .adm-sidebar{display:none}
          .adm-bottom-nav{display:flex;justify-content:space-around;align-items:center}
          .adm-main{padding:16px 14px 90px}
          .adm-topbar-email{display:none}
        }
      `}</style>
      <div className="adm-wrap">
        {/* Top bar */}
        <div style={{ background:'rgba(255,255,255,.04)', borderBottom:'1px solid rgba(255,255,255,.08)', padding:'0 16px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:'linear-gradient(135deg,#f97316,#dc2626)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900, color:'#fff' }}>FT</div>
            <span style={{ fontWeight:800, fontSize:15 }}>FoodTaxi <span style={{ color:'#fbbf24' }}>Admin</span></span>
          </div>
          <a href="/" style={{ fontSize:12, color:'rgba(255,255,255,.5)', textDecoration:'none', padding:'5px 12px', border:'1px solid rgba(255,255,255,.12)', borderRadius:8 }}>← Site</a>
        </div>

        <div className="adm-body">
          {/* Sidebar */}
          <div className="adm-sidebar">
            {NAV.map(({ label, icon, href }) => {
              const active = href === '/admin/homepage'
              return (
                <a key={href} href={href} style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:10, marginBottom:3, fontSize:14, fontWeight:600, textDecoration:'none', color: active ? '#fbbf24' : 'rgba(255,255,255,.55)', background: active ? 'rgba(251,191,36,.1)' : 'transparent', border: active ? '1px solid rgba(251,191,36,.2)' : '1px solid transparent' }}>
                  <span>{icon}</span>{label}
                </a>
              )
            })}
          </div>

          <div className="adm-main">
            <HomepageEditor initial={sections} />
          </div>
        </div>

        {/* Mobile bottom nav */}
        <nav className="adm-bottom-nav">
          {NAV.map(({ label, icon, href }) => {
            const active = href === '/admin/homepage'
            return (
              <a key={href} href={href} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, textDecoration:'none', color: active ? '#fbbf24' : 'rgba(255,255,255,.4)', fontSize:10, fontWeight:600, minWidth:44 }}>
                <span style={{ fontSize:18 }}>{icon}</span>
                {label}
              </a>
            )
          })}
        </nav>
      </div>
    </>
  )
}
