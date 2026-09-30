import { PlannedModule } from '@/components/layout/planned-module'

export const metadata = { title: 'Backtesting' }

export default function Page() {
  return (
    <PlannedModule
      title="Score backtesting"
      phase="Build phase 15"
      summary="Tests whether companies that historically scored higher went on to perform better — the only honest way to learn whether the methodology has predictive usefulness."
      scope={[
        'Point-in-time scores recomputed from data available on each historical date (no look-ahead bias: filings are used from their filing date, not period end)',
        'Survivorship-bias-free universe including delisted companies',
        'Buckets: 80–100, 60–79, 40–59, below 40',
        'Forward 1-, 3- and 5-year total returns vs relevant benchmarks, with hit rates and dispersion',
        'Results stored in the backtests table and published with their limitations',
      ]}
    />
  )
}
