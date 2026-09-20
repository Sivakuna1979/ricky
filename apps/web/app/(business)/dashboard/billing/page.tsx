// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FOODTAXI_MONTHLY_PRICE_GBP, FOODTAXI_TRIAL_DAYS } from '@/lib/subscriptionConfig'
import { computeHasAccess, trialDaysRemaining } from '@/lib/subscriptionAccess'
import { StartSubscriptionButton, ManageSubscriptionButton } from '@/components/billing/SubscriptionActions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Billing & Plan — FoodTaxi' }

export default async function BillingPage({ searchParams }: { searchParams: { expired?: string; subscribed?: string } }) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) redirect('/login')

  let { data: userData } = await supabase
    .from('users').select('id, role').eq('auth_id', user.id).maybeSingle()

  let business: any = null
  let isStaffViewer = false
  try {
    if (userData?.id) {
      const { data: b } = await supabase
        .from('businesses')
        .select('*, subscriptions(status, trial_ends_at, current_period_end, grandfathered, cancelled_at, stripe_subscription_id)')
        .eq('owner_id', userData.id).maybeSingle()
      business = b
    }
    // Phase C: a staff account has no owned business, but still needs to
    // see (read-only) why the dashboard sent them here if the owner's
    // subscription has lapsed — see middleware.ts.
    if (!business && userData?.id) {
      const { data: staffRow } = await supabase.from('staff').select('business_id').eq('user_id', userData.id).eq('is_active', true).limit(1).maybeSingle()
      if (staffRow?.business_id) {
        const { data: b } = await supabase
          .from('businesses')
          .select('*, subscriptions(status, trial_ends_at, current_period_end, grandfathered, cancelled_at, stripe_subscription_id)')
          .eq('id', staffRow.business_id).maybeSingle()
        business = b
        isStaffViewer = !!b
      }
    }
    if (!business) { const { data: r } = await supabase.rpc('get_my_business'); if (r) business = r }
  } catch (_e) {}
  if (!business) redirect('/register/business')

  const sub = (business.subscriptions as any)?.[0] ?? null
  const status = sub?.status ?? null
  const hasAccess = computeHasAccess(sub)
  const isTrialing = status === 'trialing' && !sub?.grandfathered
  const daysRemaining = isTrialing ? trialDaysRemaining(sub?.trial_ends_at) : 0
  const trialEnd = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null
  const hasSubscribedBefore = !!sub && (status === 'active' || status === 'past_due' || status === 'cancelled' || status === 'unpaid')

  const NAV = [
    { icon: '📊', label: 'Dashboard',  href: '/dashboard',          active: false },
    { icon: '🚐', label: 'My Vans',    href: '/dashboard/vans',     active: false },
    { icon: '📦', label: 'Orders',     href: '/dashboard/orders',   active: false },
    { icon: '🧾', label: 'POS',        href: '/dashboard/pos',      active: false },
    { icon: '🍳', label: 'Kitchen',    href: '/dashboard/kitchen',  active: false },
    { icon: '📋', label: 'Menu',       href: '/dashboard/menu',     active: false },
    { icon: '📦', label: 'Stock',      href: '/dashboard/stock',    active: false },
    { icon: '🚚', label: 'Suppliers',  href: '/dashboard/suppliers',active: false },
    { icon: '👥', label: 'Team',       href: '/dashboard/team',     active: false },
    { icon: '🔧', label: 'Fleet',      href: '/dashboard/fleet',    active: false },
    { icon: '📈', label: 'Analytics',  href: '/dashboard/analytics',active: false },
    { icon: '💳', label: 'My Plan',    href: '/dashboard/billing',  active: true  },
    { icon: '🎪', label: 'Events',     href: '/van/events',         active: false },
    { icon: '🧼', label: 'Hygiene',    href: '/dashboard/hygiene',  active: false },
    { icon: '💬', label: 'WhatsApp',   href: '/dashboard/whatsapp', active: false },
    { icon: '📣', label: 'Marketing', href: '/dashboard/marketing' },
    { icon: '⚙️', label: 'Settings',  href: '/dashboard/settings', active: false },
  ]

  const statusLabel: Record<string, string> = {
    trialing: '⏳ Free Trial',
    active: '✅ Active',
    past_due: '⚠️ Payment Issue',
    cancelled: '⛔ Cancelled',
    unpaid: '⚠️ Payment Issue',
  }
  const statusColor: Record<string, string> = {
    trialing: '#92400e', active: '#065f46', past_due: '#991b1b', cancelled: '#991b1b', unpaid: '#991b1b',
  }
  const statusBg: Record<string, string> = {
    trialing: '#fef3c7', active: '#d1fae5', past_due: '#fee2e2', cancelled: '#fee2e2', unpaid: '#fee2e2',
  }

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
            <p style={{ color:'#888', margin:'0 0 24px', fontSize:13 }}>Manage your FoodTaxi Business subscription</p>

            {searchParams?.expired === '1' && !hasAccess && (
              <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:12, padding:'14px 18px', marginBottom:20, color:'#991b1b', fontSize:13, fontWeight:600 }}>
                Your FoodTaxi subscription has ended, so the business dashboard is limited to this billing page for now. Reactivate below to get back to full access — nothing about your business, vans, menu, or order history has been touched.
              </div>
            )}
            {searchParams?.subscribed === '1' && (
              <div style={{ background:'#d1fae5', border:'1px solid #6ee7b7', borderRadius:12, padding:'14px 18px', marginBottom:20, color:'#065f46', fontSize:13, fontWeight:600 }}>
                🎉 Subscription started — welcome to FoodTaxi Business.
              </div>
            )}

            <div style={{ background:'#fff', borderRadius:14, padding:'24px', boxShadow:'0 1px 3px rgba(0,0,0,0.07)', marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', marginBottom:8 }}>FoodTaxi Business</div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                <div>
                  <div style={{ fontSize:24, fontWeight:800, color:'#111' }}>£{FOODTAXI_MONTHLY_PRICE_GBP.toFixed(2)}<span style={{ fontSize:14, fontWeight:500, color:'#888' }}>/month</span></div>
                  <div style={{ fontSize:13, color:'#888', marginTop:4 }}>First {FOODTAXI_TRIAL_DAYS} days free</div>
                  {sub?.grandfathered && (
                    <div style={{ fontSize:12, color:'#6366f1', marginTop:6, fontWeight:600 }}>This account was active before FoodTaxi billing launched, so access continues as normal until you choose to subscribe.</div>
                  )}
                  {isTrialing && trialEnd && (
                    <div style={{ fontSize:13, color:'#b45309', marginTop:6, fontWeight:600 }}>
                      FoodTaxi Free Trial — {daysRemaining} day{daysRemaining === 1 ? '' : 's'} remaining (ends {trialEnd.toLocaleDateString('en-GB')})
                    </div>
                  )}
                  {status === 'active' && periodEnd && (
                    <div style={{ fontSize:13, color:'#065f46', marginTop:6, fontWeight:600 }}>Next renewal {periodEnd.toLocaleDateString('en-GB')}</div>
                  )}
                </div>
                {status && (
                  <div style={{ padding:'8px 20px', borderRadius:10, background: statusBg[status] ?? '#eef2ff', color: statusColor[status] ?? '#3730a3', fontWeight:700, fontSize:13 }}>
                    {statusLabel[status] ?? status}
                  </div>
                )}
              </div>
            </div>

            {!hasAccess && isStaffViewer && (
              <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:12, padding:'14px 18px', marginBottom:20, color:'#991b1b', fontSize:13, fontWeight:600 }}>
                This business's FoodTaxi subscription has ended. Only the business owner can reactivate it — please contact them.
              </div>
            )}

            {!hasAccess && !isStaffViewer && (
              <div style={{ background:'linear-gradient(135deg,#f97316,#dc2626)', borderRadius:14, padding:'24px', color:'#fff', marginBottom:20 }}>
                <div style={{ fontWeight:800, fontSize:18, marginBottom:8 }}>
                  {sub ? 'Reactivate your FoodTaxi subscription' : 'Start your free trial'}
                </div>
                <p style={{ fontSize:14, color:'rgba(255,255,255,0.85)', margin:'0 0 16px', lineHeight:1.6 }}>
                  {sub
                    ? `£${FOODTAXI_MONTHLY_PRICE_GBP.toFixed(2)}/month, billed through Stripe. Your business data is untouched — this just restores dashboard access.`
                    : `${FOODTAXI_TRIAL_DAYS} days free, then £${FOODTAXI_MONTHLY_PRICE_GBP.toFixed(2)}/month. Cancel any time.`}
                </p>
                <StartSubscriptionButton label={sub ? 'Reactivate Subscription' : 'Start Free Trial'} />
              </div>
            )}

            {sub?.grandfathered && !isStaffViewer && (
              <div style={{ background:'#fff', borderRadius:14, padding:'24px', boxShadow:'0 1px 3px rgba(0,0,0,0.07)', marginBottom:20 }}>
                <div style={{ fontWeight:700, fontSize:15, color:'#111', marginBottom:8 }}>Want to start real billing anyway?</div>
                <p style={{ fontSize:13, color:'#666', margin:'0 0 16px' }}>
                  Your access doesn't depend on this — it's completely optional. If you'd like to move onto real Stripe billing (£{FOODTAXI_MONTHLY_PRICE_GBP.toFixed(2)}/month) now, you can start it here.
                </p>
                <StartSubscriptionButton label="Start Subscription" />
              </div>
            )}

            {(hasAccess || hasSubscribedBefore) && !!sub?.stripe_subscription_id && !sub?.grandfathered && !isStaffViewer && (
              <div style={{ background:'#fff', borderRadius:14, padding:'24px', boxShadow:'0 1px 3px rgba(0,0,0,0.07)', marginBottom:20 }}>
                <div style={{ fontWeight:700, fontSize:15, color:'#111', marginBottom:8 }}>Manage your subscription</div>
                <p style={{ fontSize:13, color:'#666', margin:'0 0 16px' }}>
                  Update your payment method, view invoices, or cancel — handled securely by Stripe.
                </p>
                <ManageSubscriptionButton />
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
