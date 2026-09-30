import { getCompanyDataset, normaliseTicker } from '@/lib/data/dataset'
import { buildAnalysis } from '@/lib/analysis/build'
import { renderReport } from '@/lib/report/pdf'
import { getViewer, viewerKey } from '@/lib/auth/viewer'
import { hasFeature } from '@/lib/plans'
import { clientKey, rateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'

/** Server-generated PDF research report. */
export async function GET(req: Request, { params }: { params: { ticker: string } }) {
  const viewer = await getViewer()
  if (!hasFeature(viewer.plan, 'reports')) return Response.json({ error: 'PDF reports are available on Premium and Professional plans.' }, { status: 403 })
  if (!rateLimit(`report:${viewerKey(viewer, clientKey(req))}`, 20, 3_600_000).ok) return Response.json({ error: 'Report limit reached — try again later.' }, { status: 429 })
  const ticker = normaliseTicker(params.ticker)
  if (!ticker) return Response.json({ error: 'Invalid ticker' }, { status: 400 })
  const ds = await getCompanyDataset(ticker)
  const a = ds ? buildAnalysis(ds) : null
  if (!a) return Response.json({ error: 'Data unavailable for this ticker' }, { status: 404 })
  const pdf = await renderReport(a)
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="evidentia-${ticker}-report.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
