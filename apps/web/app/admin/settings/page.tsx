// @ts-nocheck
import { AdminShell } from '../_shared'

export const dynamic = 'force-dynamic'

const SETTINGS = [
  {
    icon: '🌐',
    title: 'Site URL',
    desc: 'food-taxi.vercel.app',
    action: 'Open Site',
    href: 'https://food-taxi.vercel.app',
    external: true,
  },
  {
    icon: '📧',
    title: 'Support Email',
    desc: 'sivakuna@icloud.com',
    action: 'Send Email',
    href: 'mailto:sivakuna@icloud.com',
    external: true,
  },
  {
    icon: '🔐',
    title: 'Admin Accounts',
    desc: 'Manage who has admin access',
    action: 'Manage',
    href: '/admin/users',
    external: false,
  },
  {
    icon: '🏠',
    title: 'Homepage Sections',
    desc: 'Reorder and show/hide homepage sections',
    action: 'Edit',
    href: '/admin/homepage',
    external: false,
  },
  {
    icon: '🚐',
    title: 'Businesses',
    desc: 'View and manage registered businesses',
    action: 'View',
    href: '/admin/businesses',
    external: false,
  },
  {
    icon: '📦',
    title: 'Orders',
    desc: 'View all customer orders',
    action: 'View',
    href: '/admin/orders',
    external: false,
  },
  {
    icon: '💰',
    title: 'Pricing Plans',
    desc: 'Manage FoodTaxi subscription plans shown to businesses',
    action: 'Manage Plans',
    href: '/admin/plans',
    external: false,
  },
  {
    icon: '💳',
    title: 'Billing / Stripe',
    desc: 'Stripe dashboard — manage subscriptions & invoices',
    action: 'Open Stripe',
    href: 'https://dashboard.stripe.com',
    external: true,
  },
  {
    icon: '🗄️',
    title: 'Database',
    desc: 'Supabase project: fzrridbzelijulofgzxo',
    action: 'Open Supabase',
    href: 'https://supabase.com/dashboard/project/fzrridbzelijulofgzxo',
    external: true,
  },
  {
    icon: '🚀',
    title: 'Deployments',
    desc: 'Vercel — view builds and logs',
    action: 'Open Vercel',
    href: 'https://vercel.com/dashboard',
    external: true,
  },
]

export default function AdminSettingsPage() {
  return (
    <AdminShell active="/admin/settings">
      <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#fff' }}>Settings</h1>
      <p style={{ fontSize:13, color:'rgba(255,255,255,.4)', margin:'0 0 28px' }}>Site configuration and admin tools</p>

      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {SETTINGS.map(({ icon, title, desc, action, href, external }) => (
          <div key={title} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:14, padding:'16px 18px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:14, flex:1, minWidth:0 }}>
              <span style={{ fontSize:20, flexShrink:0 }}>{icon}</span>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>{title}</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,.4)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{desc}</div>
              </div>
            </div>
            <a
              href={href}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
              style={{ fontSize:12, fontWeight:700, padding:'7px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.06)', color:'rgba(255,255,255,.8)', cursor:'pointer', textDecoration:'none', whiteSpace:'nowrap', flexShrink:0, marginLeft:12, display:'inline-flex', alignItems:'center', gap:5 }}
            >
              {action}{external ? ' ↗' : ' →'}
            </a>
          </div>
        ))}
      </div>

      <div style={{ marginTop:28, padding:'18px 20px', background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.2)', borderRadius:14 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#ef4444', marginBottom:4 }}>⚠️ Danger Zone</div>
        <p style={{ fontSize:12, color:'rgba(255,255,255,.35)', margin:'0 0 14px' }}>These actions are irreversible. Proceed with caution.</p>
        <a href="https://supabase.com/dashboard/project/fzrridbzelijulofgzxo/editor" target="_blank" rel="noopener noreferrer"
          style={{ fontSize:13, fontWeight:700, padding:'9px 20px', borderRadius:8, border:'1px solid rgba(239,68,68,.4)', background:'rgba(239,68,68,.1)', color:'#ef4444', cursor:'pointer', textDecoration:'none', display:'inline-block' }}>
          Open SQL Editor ↗
        </a>
      </div>
    </AdminShell>
  )
}
