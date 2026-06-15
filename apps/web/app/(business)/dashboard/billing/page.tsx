// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Billing & Plan — FoodTaxi' }

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const user = session.user

  let { data: userData } = await supabase
    .from('users').select('id, role').eq('auth_id', user.id).maybeSingle()

  let { data: business } = userData?.id
    ? await supabase
        .from('businesses')
        .select('*, subscriptions(status, trial_ends_at, subscription_plans(name, price))')
        .eq('owner_id', userData.id)
        .maybeSingle()
    : { data: null }

  // RPC fallback if business not found via RLS
  if (!business) {
    const { data: rpcBiz } = await supabase.rpc('get_my_business').maybeSingle()
    if (rpcBiz) business = rpcBiz
  }

  if (!business) redirect('/register/business')

  const sub = (business.subscriptions as any)?.[0]
  const planName = sub?.subscription_plans?.name ?? 'starter'
  const planPrice = sub?.subscription_plans?.price ?? 0
  const subStatus = sub?.status ?? 'active'
  const trialEnd = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null
  const isTrialing = subStatus === 'trialing'

  const NAV = [
    { icon: '📊', label: 'Dashboard',  href: '/dashboard',          active: false },
    { icon: '🚐', label: 'My Vans',    href: '/dashboard/vans',     active: false },
    { icon: '📦', label: 'Orders',     href: '/dashboard/orders',   active: false },
    { icon: '📋', label: 'Menu',       href: '/dashboard/menu',     active: false },
    { icon: '💳', label: 'My Plan',    href: '/dashboard/billing',  active: true  },
    { icon: '🎪', label: 'Events',     href: '/van/events',         active: false },
    { icon: '⚙️', label: 'Settings',  href: '/dashboard/settings', active: false },
  ]

  return (
    <>
      <style>{`
        html,body{margin:0;padding:0}
        .biz-wrap{display:flex;flex-direction:column;min-height:100vh;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
        .biz-topbar{background:#fff;border-bottom:1px solid #e5e7eb;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
        .biz-sidebar{width:220px;flex-shrink:0;background:#fff;border-right:1px solid #e5e7eb;padding:16px 10px;min-height:calc(100vh - 56px)}
        .biz-main{flex:1;padding:24px;overflow-x:hidden;max-width:700px}
        .biz-body{display:flex;flex:1}
        .pub-site-link{display:inline-block}@media(max-width:700px){.biz-sidebar{display:none}.biz-main{padding:16px 14px 90px}.pub-site-link{display:none}}
      `}</style>
      <div className="biz-wrap">
        <div className="biz-topbar">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#f97316,#dc2626)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:'#fff' }}>FT</div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#111', lineHeight:1 }}>FoodTaxi</div>
              <div style={{ fontSize:11, color:'#888' }}>{business.name}</div>
            </div>
          </div>
          <a href="/" className="pub-site-link" style={{ fontSize:12, color:'#6366f1', textDecoration:'none', padding:'5px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontWeight:600 }}>← Public Site</a>
        </div>
        <div className="biz-body">
          <div className="biz-sidebar">
            {NAV.map(n => (
              <a key={n.href} href={n.href} style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:10, marginBottom:3, fontSize:14, fontWeight:600, textDecoration:'none', color: n.active ? '#f97316' : '#555', background: n.active ? '#fff7ed' : 'transparent', border: n.active ? '1px solid #fed7aa' : '1px solid transparent' }}>
                <span style={{ fontSize:16 }}>{n.icon}</span>{n.label}
              </a>
            ))}
            <div style={{ margin:'16px 0 0', paddingTop:12, borderTop:'1px solid #f3f4f6' }}>
              <a href="/api/auth/logout" style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:10, fontSize:13, fontWeight:600, textDecoration:'none', color:'#ef4444' }}>🚪 Sign Out</a>
            </div>
          </div>
          <div className="biz-main">
            <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#111' }}>Billing & Plan</h1>
            <p style={{ color:'#888', margin:'0 0 24px', fontSize:13 }}>Manage your subscription and billing details</p>

            <div style={{ background:'#fff', borderRadius:14, padding:'24px', boxShadow:'0 1px 3px rgba(0,0,0,0.07)', marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', marginBottom:8 }}>Current Plan</div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                <div>
                  <div style={{ fontSize:24, fontWeight:800, color:'#111' }}>{planName.charAt(0).toUpperCase() + planName.slice(1)} Plan</div>
                  <div style={{ fontSize:13, color:'#888', marginTop:4 }}>
                    Status: <span style={{ color: subStatus === 'active' ? '#059669' : '#f59e0b', fontWeight:700 }}>{subStatus}</span>
                    {planPrice > 0 && <span> · £{(planPrice / 100).toFixed(2)}/mo</span>}
                  </div>
                  {isTrialing && trialEnd && (
                    <div style={{ fontSize:13, color:'#b45309', marginTop:4 }}>Trial ends {trialEnd.toLocaleDateString('en-GB')}</div>
                  )}
                </div>
                <div style={{ padding:'8px 20px', borderRadius:10, background: isTrialing ? '#fef3c7' : '#d1fae5', color: isTrialing ? '#92400e' : '#065f46', fontWeight:700, fontSize:13 }}>
                  {isTrialing ? '⏳ Trial Active' : '✅ Active'}
                </div>
              </div>
            </div>

            {isTrialing && (
              <div style={{ background:'linear-gradient(135deg,#f97316,#dc2626)', borderRadius:14, padding:'24px', color:'#fff', marginBottom:20 }}>
                <div style={{ fontWeight:800, fontSize:18, marginBottom:8 }}>Upgrade to unlock full access</div>
                <p style={{ fontSize:14, color:'rgba(255,255,255,0.8)', margin:'0 0 16px', lineHeight:1.6 }}>
                  Your trial gives you access to all features. Upgrade before it ends to keep your account running.
                </p>
                <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'16px', marginBottom:16 }}>
                  <div style={{ fontSize:13, color:'rgba(255,255,255,0.7)', marginBottom:4 }}>FoodTaxi Plan</div>
                  <div style={{ fontSize:28, fontWeight:900 }}>£49<span style={{ fontSize:14, fontWeight:400 }}>/month</span></div>
                </div>
                <a href="mailto:hello@foodtaxi.co.uk?subject=Upgrade my plan" style={{ display:'inline-block', padding:'12px 24px', borderRadius:10, background:'#fff', color:'#f97316', fontWeight:800, fontSize:14, textDecoration:'none' }}>
                  Upgrade Now →
                </a>
              </div>
            )}

            <div style={{ background:'#fff', borderRadius:14, padding:'24px', boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
              <div style={{ fontWeight:700, fontSize:15, color:'#111', marginBottom:16 }}>Need help with billing?</div>
              <p style={{ fontSize:14, color:'#666', margin:'0 0 16px', lineHeight:1.6 }}>
                Contact our team at <a href="mailto:hello@foodtaxi.co.uk" style={{ color:'#f97316', fontWeight:600 }}>hello@foodtaxi.co.uk</a> for any billing questions, plan changes, or cancellation requests.
              </p>
              <a href="mailto:hello@foodtaxi.co.uk?subject=Billing enquiry" style={{ display:'inline-block', padding:'10px 20px', borderRadius:10, background:'#f5f6fa', border:'1px solid #e5e7eb', color:'#374151', fontWeight:600, fontSize:13, textDecoration:'none' }}>
                Contact Support →
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
