import { getUniverse } from '@/lib/screener/universe'
import { getViewer } from '@/lib/auth/viewer'
import { hasFeature, LIMITS } from '@/lib/plans'
import { PortfolioView } from '@/components/portfolio/portfolio-view'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Portfolio' }
export const dynamic = 'force-dynamic'

export default async function PortfolioPage() {
  const viewer = await getViewer()
  if (viewer.authConfigured && !viewer.user) redirect('/sign-in?next=/portfolio')
  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-10 sm:px-6">
      <header>
        <div className="label">Portfolio</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">Your portfolios</h1>
        <p className="mt-1 max-w-3xl text-sm text-fg-3">Track holdings and see what the data says about concentration and quality. The platform highlights data and risks — it does not tell you what to buy or sell.</p>
      </header>
      <PortfolioView universe={getUniverse()} analytics={hasFeature(viewer.plan, 'portfolio_analytics')} maxPortfolios={LIMITS[viewer.plan].portfolios} />
    </div>
  )
}
