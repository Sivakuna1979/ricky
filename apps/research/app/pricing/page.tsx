import Link from 'next/link'
import { Check } from 'lucide-react'
import { LIMITS, PLAN_INFO, type Plan } from '@/lib/plans'
import { getViewer } from '@/lib/auth/viewer'

export const metadata = { title: 'Plans' }

export default async function PricingPage() {
  const viewer = await getViewer()
  const plans: Plan[] = ['free', 'premium', 'professional']
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <h1 className="text-center text-3xl font-semibold tracking-tight text-fg">Plans</h1>
      <p className="mx-auto mt-2 max-w-2xl text-center text-fg-3">Every plan gets the same transparent methodology. Paid plans unlock depth, tools and data export — never different “answers”.</p>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const info = PLAN_INFO[p]
          const current = viewer.plan === p && !viewer.demoUnlocked
          return (
            <div key={p} className={`card card-pad flex flex-col ${p === 'premium' ? 'border-accent/50' : ''}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-fg">{info.name}</h2>
                {p === 'premium' && <span className="chip border-accent/40 bg-accent-soft text-accent">Most popular</span>}
              </div>
              <div className="num mt-2 text-2xl font-semibold text-fg">{info.price}</div>
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
                  <span className="btn w-full justify-center opacity-70">Current plan</span>
                ) : p === 'free' ? (
                  <Link href="/sign-in" className="btn w-full justify-center">
                    Get started
                  </Link>
                ) : (
                  <Link href={`/sign-in?next=/account?upgrade=${p}`} className="btn btn-primary w-full justify-center">
                    Choose {info.name}
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-8 text-center text-xs text-fg-4">
        Billing is not yet connected in this deployment. Plan changes are applied by an administrator (users.plan) until the payment integration is added.
      </p>
    </div>
  )
}
