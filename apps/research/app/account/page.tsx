import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getViewer } from '@/lib/auth/viewer'
import { FEATURE_MIN_PLAN, hasFeature, LIMITS, PLAN_INFO, type Feature } from '@/lib/plans'
import { Callout } from '@/components/ui/section'

export const metadata = { title: 'Account' }
export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const v = await getViewer()
  if (v.authConfigured && !v.user) redirect('/sign-in?next=/account')
  const features = Object.keys(FEATURE_MIN_PLAN) as Feature[]
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-semibold text-fg">Account</h1>
      {v.demoUnlocked && (
        <Callout tone="demo" title="Demo deployment">
          Authentication isn&apos;t configured, so this instance runs with the {PLAN_INFO[v.plan].name} plan unlocked for everyone and stores your data in this browser.
        </Callout>
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
