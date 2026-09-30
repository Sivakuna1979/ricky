import { redirect } from 'next/navigation'
import { getUniverse } from '@/lib/screener/universe'
import { getViewer } from '@/lib/auth/viewer'
import { hasFeature } from '@/lib/plans'
import { WatchlistView } from '@/components/portfolio/watchlist-view'
import { LockedCard } from '@/components/ui/locked'

export const metadata = { title: 'Watchlist & alerts' }
export const dynamic = 'force-dynamic'

export default async function WatchlistPage() {
  const viewer = await getViewer()
  if (viewer.authConfigured && !viewer.user) redirect('/sign-in?next=/watchlist')
  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-10 sm:px-6">
      <header>
        <div className="label">Watchlist</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">Watchlist & alerts</h1>
      </header>
      {hasFeature(viewer.plan, 'watchlists') ? (
        <WatchlistView universe={getUniverse()} alertsEnabled={viewer.authConfigured} />
      ) : (
        <LockedCard feature="watchlists" title="Watchlists & alerts" />
      )}
    </div>
  )
}
