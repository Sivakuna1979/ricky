import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getViewer } from '@/lib/auth/viewer'
import { FEATURE_MIN_PLAN, hasFeature, LIMITS, PLAN_INFO, type Feature } from '@/lib/plans'
import { Callout } from '@/components/ui/section'
import { supabaseAdmin } from '@/lib/auth/admin'
import { fmtDate } from '@/lib/format'

export const metadata = { title: 'Account' }
export const dynamic = 'force-dynamic'

export default async function AccountPage({ searchParams }: { searchParams: { checkout?: string } }) {
  const v = await getViewer()
  if (v.authConfigured && !v.user) redirect('/sign-in?next=/account')
  const features = Object.keys(FEATURE_MIN_PLAN) as Feature[]
  const db = v.user ? supabaseAdmin() : null
  const billing = db
    ? (await db.from('users').select('subscription_status,trial_ends_at,current_period_end,cancel_at_period_end,stripe_customer_id').eq('id', v.user!.id).maybeSingle()).data
    : null
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-semibold text-fg">Account</h1>
      {v.demoUnlocked && (
        <Callout title="Free beta">
          Every feature is unlocked for everyone during the beta. No account is needed — your watchlists and portfolios are saved in this browser only (clearing your browser data removes them).
        </Callout>
      )}
      {searchParams.checkout === 'success' && <Callout title="Welcome to Premium">Your free trial has started. It can take a few seconds for your plan to update — refresh if it still shows Free.</Callout>}
      {billing?.subscription_status && (
        <div className="card card-pad text-sm text-fg-2">
          <h2 className="mb-2 font-semibold text-fg">Subscription</h2>
          {billing.subscription_status === 'trialing' && (
            <p>
              Free trial until <strong className="text-fg">{fmtDate(billing.trial_ends_at ?? undefined)}</strong>
              {billing.cancel_at_period_end ? ' — cancelled; you will not be charged.' : ', then £9.99/month.'}
            </p>
          )}
          {billing.subscription_status === 'active' && (
            <p>
              Premium · £9.99/month · {billing.cancel_at_period_end ? 'ends' : 'renews'} on <strong className="text-fg">{fmtDate(billing.current_period_end ?? undefined)}</strong>
            </p>
          )}
          {billing.subscription_status === 'past_due' && <p className="text-neu">Your last payment failed. Please update your card to keep Premium.</p>}
          {['canceled', 'unpaid', 'incomplete_expired'].includes(billing.subscription_status) && <p>Your subscription has ended.</p>}
          {billing.stripe_customer_id && (
            <form action="/api/billing/portal" method="post" className="mt-3">
              <button className="btn">Manage billing · cancel · invoices</button>
            </form>
          )}
        </div>
      )}
      <div className="card card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="label">Signed in as</div>
            <div className="text-fg">{v.user?.email ?? 'Demo user'}</div>
          </div>
          <div className="text-right">
            <div className="label">Plan</div>
            <div className="text-lg font-semibold text-fg">{PLAN_INFO[v.plan].name}</div>
          </div>
        </div>
        <div className="mt-4 text-sm text-fg-3">
          {LIMITS[v.plan].aiQueriesPerDay} AI questions/day · {LIMITS[v.plan].searchesPerDay} searches/day · up to {LIMITS[v.plan].portfolios} portfolios
        </div>
        <div className="mt-4 flex gap-2">
          <Link href="/pricing" className="btn">
            Compare plans
          </Link>
          {v.user && (
            <form action="/auth/sign-out" method="post">
              <button className="btn">Sign out</button>
            </form>
          )}
        </div>
      </div>
      <div className="card card-pad">
        <h2 className="mb-3 font-semibold text-fg">Features on your plan</h2>
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
          {features.map((f) => (
            <li key={f} className={hasFeature(v.plan, f) ? 'text-fg-2' : 'text-fg-4 line-through'}>
              {f.replace(/_/g, ' ')}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
