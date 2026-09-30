import Link from 'next/link'
import { Check } from 'lucide-react'
import { LIMITS, PLAN_INFO, type Plan } from '@/lib/plans'
import { getViewer } from '@/lib/auth/viewer'
import { billingConfigured, TRIAL_DAYS } from '@/lib/billing/stripe'
import { Callout } from '@/components/ui/section'

export const metadata = { title: 'Plans' }
export const dynamic = 'force-dynamic'

export default async function PricingPage({ searchParams }: { searchParams: { billing?: string; checkout?: string } }) {
  const viewer = await getViewer()
  const billing = billingConfigured()
  const plans: Plan[] = ['free', 'premium', 'professional']
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <h1 className="text-center text-3xl font-semibold tracking-tight text-fg">Plans</h1>
      <p className="mx-auto mt-2 max-w-2xl text-center text-fg-3">Every plan gets the same transparent methodology. Paid plans unlock depth and tools — never different “answers”.</p>
      {searchParams.checkout === 'cancelled' && (
        <div className="mx-auto mt-6 max-w-xl">
          <Callout>Checkout was cancelled — nothing was charged.</Callout>
        </div>
      )}
      {(searchParams.billing === 'unavailable' || !billing) && (
        <div className="mx-auto mt-6 max-w-xl">
          <Callout tone="demo">Payments are not connected in this deployment yet, so the free trial can’t be started online. {viewer.demoUnlocked ? 'This demo has every feature unlocked.' : ''}</Callout>
        </div>
      )}
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const info = PLAN_INFO[p]
          const current = viewer.plan === p && !viewer.demoUnlocked
          return (
            <div key={p} className={`card card-pad flex flex-col ${p === 'premium' ? 'border-accent/50' : ''}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-fg">{info.name}</h2>
                {p === 'premium' && <span className="chip border-accent/40 bg-accent-soft text-accent">{TRIAL_DAYS / 30} months free</span>}
              </div>
              <div className="num mt-2 text-xl font-semibold text-fg">{info.price}</div>
              <p className="mt-1 text-sm text-fg-3">{info.blurb}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {info.features.map((f) => (
                  <li key={f} className="flex gap-2 text-fg-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-pos" /> {f}
                  </li>
                ))}
                <li className="pt-2 text-xs text-fg-4">
                  {LIMITS[p].aiQueriesPerDay ? `${LIMITS[p].aiQueriesPerDay} AI questions/day · ` : ''}
                  {LIMITS[p].searchesPerDay} searches/day
                </li>
              </ul>
              <div className="mt-5">
                {current ? (
                  <Link href="/account" className="btn w-full justify-center">
                    Current plan
                  </Link>
                ) : p === 'free' ? (
                  <Link href="/sign-in" className="btn w-full justify-center">
                    Get started
                  </Link>
                ) : p === 'premium' ? (
                  <form action="/api/billing/checkout" method="post">
                    <button className="btn btn-primary w-full justify-center" disabled={!billing}>
                      Start 3-month free trial
                    </button>
                  </form>
                ) : (
                  <span className="btn w-full justify-center opacity-60">Coming soon</span>
                )}
              </div>
              {p === 'premium' && (
                <p className="mt-3 text-[11px] leading-relaxed text-fg-4">
                  Card required. Free for {TRIAL_DAYS} days, then £9.99 per month until you cancel. Cancel any time from your account before the trial ends and you won’t be charged.
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
