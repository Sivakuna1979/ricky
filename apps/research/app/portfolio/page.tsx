import { PlannedModule } from '@/components/layout/planned-module'

export const metadata = { title: 'Portfolio' }

export default function Page() {
  return (
    <PlannedModule
      title="Portfolios & watchlists"
      phase="Build phase 13"
      summary="Track holdings and watchlists with data-driven concentration and quality analytics. The platform highlights data and risks — it never tells you what to buy or sell."
      scope={[
        'Holdings, purchase price, current value, profit/loss and allocation',
        'Sector, country and single-stock concentration warnings',
        'Dividend income and portfolio-weighted quality score',
        'Watchlist alerts: earnings, price moves, new SEC filings, dividend changes, estimate changes, score changes, valuation entering a chosen range',
        'Row-level security: users only ever see their own portfolios',
      ]}
    />
  )
}
