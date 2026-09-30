import { getViewer } from '@/lib/auth/viewer'
import { hasFeature } from '@/lib/plans'
import { BacktestView } from '@/components/backtest/backtest-view'
import { LockedCard } from '@/components/ui/locked'
import { Callout } from '@/components/ui/section'

export const metadata = { title: 'Score backtesting' }
export const dynamic = 'force-dynamic'

export default async function BacktestPage() {
  const viewer = await getViewer()
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-10 sm:px-6">
      <header>
        <div className="label">Backtesting</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">Does a higher score mean better outcomes?</h1>
        <p className="mt-1 max-w-3xl text-sm text-fg-3">
          The honest test of any scoring system: did companies that scored higher at the time go on to outperform? This module measures forward 1-, 3- and 5-year returns by score bucket against a benchmark, with
          explicit controls for look-ahead and survivorship bias.
        </p>
      </header>
      <Callout title="Current status: not yet measured">
        No point-in-time historical dataset is connected, so the platform has <strong>no evidence yet</strong> on whether its score is predictive. Results will be published — whatever they show — once point-in-time
        filings (with filing dates), prices and a delisted-inclusive universe are ingested into the <code>backtests</code> table.
      </Callout>
      <div className="card card-pad grid gap-4 text-sm text-fg-2 md:grid-cols-3">
        <div>
          <h2 className="mb-1 font-semibold text-fg">No look-ahead</h2>
          Each historical score uses only filings available on the score date (<code>filed_at</code>, not period end). Observations violating this are excluded and counted.
        </div>
        <div>
          <h2 className="mb-1 font-semibold text-fg">No survivorship bias</h2>
          The universe includes delisted and acquired companies with their realised returns. A sample without them is flagged.
        </div>
        <div>
          <h2 className="mb-1 font-semibold text-fg">No curve fitting</h2>
          Weights are not tuned on the evaluation period; walk-forward validation, versioned by <code>methodology_version</code>.
        </div>
      </div>
      {hasFeature(viewer.plan, 'backtesting') ? <BacktestView /> : <LockedCard feature="backtesting" title="Backtesting engine" />}
    </div>
  )
}
