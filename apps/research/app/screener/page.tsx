import { getUniverse } from '@/lib/screener/universe'
import { getViewer } from '@/lib/auth/viewer'
import { hasFeature, LIMITS } from '@/lib/plans'
import { Screener } from '@/components/screener/screener'
import { Callout } from '@/components/ui/section'

export const metadata = { title: 'Stock screener' }
export const dynamic = 'force-dynamic'

export default async function ScreenerPage() {
  const viewer = await getViewer()
  const rows = getUniverse()
  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-10 sm:px-6">
      <header>
        <div className="label">Screener</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">Find companies by the evidence</h1>
        <p className="mt-1 max-w-3xl text-sm text-fg-3">Filter on fundamentals, valuation and scores. Results are a starting point for research — never a list of recommendations.</p>
      </header>
      <Callout tone="demo">The screenable universe is the demo universe ({rows.length} companies) until a market-data provider is connected. Figures are illustrative.</Callout>
      <Screener
        rows={rows}
        advanced={hasFeature(viewer.plan, 'advanced_screener')}
        maxFilters={LIMITS[viewer.plan].screenerFilters}
        canExport={hasFeature(viewer.plan, 'advanced_export')}
      />
    </div>
  )
}
