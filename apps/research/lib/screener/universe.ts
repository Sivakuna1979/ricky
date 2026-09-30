import type { CompanySnapshot } from '@/lib/domain/types'
import { demoDataset, DEMO_UNIVERSE } from '@/lib/providers/demo'
import { buildAnalysis } from '@/lib/analysis/build'
import { toSnapshot } from '@/lib/analysis/snapshot'
import { categoryScore } from '@/lib/scoring/engine'
import { snapshotScores, type SnapshotScores } from '@/lib/scoring/snapshot'

export interface UniverseRow extends CompanySnapshot {
  scores: SnapshotScores
  moat: number | null
  demo: boolean
}

let cache: UniverseRow[] | null = null

/**
 * Screenable universe. v1: the demo universe (+ AAPL scored with the full engine).
 * With a live provider this becomes the nightly `scores` + `company_metrics` tables.
 */
export function getUniverse(): UniverseRow[] {
  if (cache) return cache
  const rows: UniverseRow[] = []
  const ds = demoDataset('AAPL')
  const a = ds ? buildAnalysis(ds) : null
  if (a) {
    const c = (k: Parameters<typeof categoryScore>[1]) => categoryScore(a.categories, k)
    rows.push({
      ...toSnapshot(a),
      demo: true,
      moat: a.moat.score,
      scores: {
        kind: 'full',
        overall: a.overall.score,
        quality: c('business_quality'),
        profitability: c('profitability'),
        growth: c('growth'),
        valuation: c('valuation'),
        financial: c('financial_strength'),
        risk: c('risk'),
        metricsUsed: a.indicators.filter((i) => i.score !== null).length,
      },
    })
  }
  for (const s of DEMO_UNIVERSE) rows.push({ ...s, demo: true, moat: null, scores: snapshotScores(s) })
  cache = rows
  return rows
}

export function universeRow(ticker: string): UniverseRow | undefined {
  return getUniverse().find((r) => r.ticker === ticker.toUpperCase())
}
