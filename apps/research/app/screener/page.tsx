import { PlannedModule } from '@/components/layout/planned-module'

export const metadata = { title: 'Stock screener' }

export default function Page() {
  return (
    <PlannedModule
      title="Advanced stock screener"
      phase="Build phase 11"
      summary="Filter the covered universe on fundamentals, valuation and platform scores — including plain-English queries translated into transparent filters you can edit."
      scope={[
        'Filters: country, exchange, sector, industry, market cap, revenue & EPS growth, P/E, PEG, P/S, EV/EBITDA, FCF yield, dividend yield, ROE, ROIC, margins, debt',
        'Score filters: Investment Quality, quality, valuation, moat and risk scores',
        'Natural-language search (e.g. “profitable companies with ROIC above 15%, revenue growth above 10%, positive FCF and reasonable valuation”) → shown as explicit filter chips before running',
        'Saved screens and CSV export (Premium / Professional)',
        'Backed by the nightly-computed scores and company_metrics tables',
      ]}
    />
  )
}
