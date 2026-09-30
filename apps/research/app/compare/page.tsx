import { PlannedModule } from '@/components/layout/planned-module'

export const metadata = { title: 'Compare companies' }

export default function Page() {
  return (
    <PlannedModule
      title="Company comparison"
      phase="Build phase 12"
      summary="Side-by-side analysis of up to five companies using the same scoring engine, so differences are apples-to-apples."
      scope={['Up to 5 tickers (e.g. AAPL, MSFT, GOOGL, AMZN, META)', 'Score radar and category bars', 'Valuation, profitability, growth and balance-sheet tables', 'Overlaid charts on one axis per measure', 'Framework scores side by side']}
    />
  )
}
