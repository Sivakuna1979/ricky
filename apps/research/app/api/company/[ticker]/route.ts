import { NextResponse } from 'next/server'
import { getCompanyDataset, normaliseTicker } from '@/lib/data/dataset'
import { buildAnalysis } from '@/lib/analysis/build'
import { clientKey, rateLimit } from '@/lib/security/rate-limit'

/**
 * JSON analysis for a ticker. Every figure in the response carries a sourceId
 * that resolves in `dataset.sources`. Raw daily prices are omitted to keep the
 * payload small (a weekly series is included as `chartPrices`).
 */
export async function GET(req: Request, { params }: { params: { ticker: string } }) {
  const rl = rateLimit(`company:${clientKey(req)}`, 30)
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const ticker = normaliseTicker(params.ticker)
  if (!ticker) return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 })
  const ds = await getCompanyDataset(ticker)
  if (!ds) return NextResponse.json({ error: 'Data unavailable for this ticker' }, { status: 404 })
  const analysis = buildAnalysis(ds)
  if (!analysis) return NextResponse.json({ error: 'Insufficient financial data' }, { status: 422 })
  const { dataset, ...rest } = analysis
  return NextResponse.json({ ...rest, dataset: { ...dataset, prices: [] } })
}
