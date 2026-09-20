// @ts-nocheck
// Shared shell for Phase C's new operational pages (Stock, Suppliers,
// Team, Fleet) — same visual language as the existing dashboard/billing/
// analytics pages (not a redesign), factored out here only because these
// are four new pages sharing identical chrome; existing pages are left
// exactly as they are.
export const NAV_ITEMS = [
  { icon: '📊', label: 'Dashboard',  href: '/dashboard' },
  { icon: '🚐', label: 'My Vans',    href: '/dashboard/vans' },
  { icon: '📦', label: 'Orders',     href: '/dashboard/orders' },
  { icon: '🧾', label: 'POS',        href: '/dashboard/pos' },
  { icon: '🍳', label: 'Kitchen',    href: '/dashboard/kitchen' },
  { icon: '📋', label: 'Menu',       href: '/dashboard/menu' },
  { icon: '🤖', label: 'FoodTaxi AI', href: '/dashboard/ai' },
  { icon: '📦', label: 'Stock',      href: '/dashboard/stock' },
  { icon: '🚚', label: 'Suppliers',  href: '/dashboard/suppliers' },
  { icon: '👥', label: 'Team',       href: '/dashboard/team' },
  { icon: '🔧', label: 'Fleet',      href: '/dashboard/fleet' },
  { icon: '🔔', label: 'Notifications', href: '/dashboard/notifications' },
  { icon: '⚡', label: 'Automations', href: '/dashboard/automations' },
  { icon: '📈', label: 'Analytics',  href: '/dashboard/analytics' },
  { icon: '💳', label: 'My Plan',    href: '/dashboard/billing' },
  { icon: '🎪', label: 'Events',     href: '/van/events' },
  { icon: '🧼', label: 'Hygiene',    href: '/dashboard/hygiene' },
  { icon: '💬', label: 'WhatsApp',   href: '/dashboard/whatsapp' },
  { icon: '📣', label: 'Marketing',  href: '/dashboard/marketing' },
  { icon: '⚙️', label: 'Settings',  href: '/dashboard/settings' },
]

export function DashboardShell({ businessName, activeHref, title, subtitle, children }: {
  businessName: string; activeHref: string; title: string; subtitle?: string; children: React.ReactNode
}) {
  return (
    <>
      <style>{`
        html,body{margin:0;padding:0}
        .biz-wrap{display:flex;flex-direction:column;min-height:100vh;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
        .biz-topbar{background:#fff;border-bottom:1px solid #e5e7eb;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
        .biz-sidebar{width:220px;flex-shrink:0;background:#fff;border-right:1px solid #e5e7eb;padding:16px 10px;min-height:calc(100vh - 56px)}
        .biz-main{flex:1;padding:24px;overflow-x:hidden;max-width:960px}
        .biz-body{display:flex;flex:1}
        .biz-bottom{display:none;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e5e7eb;z-index:100;padding:8px 10px 18px;overflow-x:auto;-webkit-overflow-scrolling:touch;gap:14px;scroll-snap-type:x proximity;overscroll-behavior-x:contain;scrollbar-width:none}
        .biz-bottom::-webkit-scrollbar{display:none}
        .pub-site-link{display:inline-block}
        @media(max-width:700px){
          .biz-sidebar{display:none}
          .biz-main{padding:16px 14px 90px}
          .biz-bottom{display:flex;justify-content:flex-start}
          .pub-site-link{display:none}
        }
      `}</style>
      <div className="biz-wrap">
        <div className="biz-topbar">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#f97316,#dc2626)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:'#fff' }}>FT</div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#111', lineHeight:1 }}>FoodTaxi</div>
              <div style={{ fontSize:11, color:'#888' }}>{businessName}</div>
            </div>
          </div>
          <a href="/" className="pub-site-link" style={{ fontSize:12, color:'#6366f1', textDecoration:'none', padding:'5px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontWeight:600 }}>← Public Site</a>
        </div>
        <div className="biz-body">
          <div className="biz-sidebar">
            {NAV_ITEMS.map(n => (
              <a key={n.href} href={n.href} style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:10, marginBottom:3, fontSize:14, fontWeight:600, textDecoration:'none', color: n.href === activeHref ? '#f97316' : '#555', background: n.href === activeHref ? '#fff7ed' : 'transparent', border: n.href === activeHref ? '1px solid #fed7aa' : '1px solid transparent' }}>
                <span style={{ fontSize:16 }}>{n.icon}</span>{n.label}
              </a>
            ))}
            <div style={{ margin:'16px 0 0', paddingTop:12, borderTop:'1px solid #f3f4f6' }}>
              <a href="/api/auth/logout" style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:10, fontSize:13, fontWeight:600, textDecoration:'none', color:'#ef4444' }}>🚪 Sign Out</a>
            </div>
          </div>
          <div className="biz-main">
            <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#111' }}>{title}</h1>
            {subtitle && <p style={{ color:'#888', margin:'0 0 24px', fontSize:13 }}>{subtitle}</p>}
            {children}
          </div>
        </div>
        <nav className="biz-bottom">
          {NAV_ITEMS.map(n => (
            <a key={n.href} href={n.href} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, textDecoration:'none', color: n.href === activeHref ? '#f97316' : '#9ca3af', fontSize:10, fontWeight:600, minWidth:56, flexShrink:0, padding:'2px 4px', scrollSnapAlign:'start' }}>
              <span style={{ fontSize:20 }}>{n.icon}</span>{n.label}
            </a>
          ))}
        </nav>
      </div>
    </>
  )
}
