import type { CompanyDataset, SourceTier } from '@/lib/domain/types'
import { interpolate } from '@/lib/finance/stats'
import type { Indicator } from './types'

const TIER_RELIABILITY: Record<SourceTier, number> = { filing: 100, provider: 90, derived: 90, estimate: 70, editorial: 70, demo: 35 }

export interface ConfidenceComponent {
  key: string
  label: string
  score: number | null
  weight: number
  note: string
}

export interface DataConfidence {
  score: number
  components: ConfidenceComponent[]
}

/**
 * Data Confidence (0–100%) — how much weight the score can bear.
 * Coverage 40% · Freshness 20% · Source reliability 25% · Historical depth 15%.
 * Cross-source consensus is reported but not yet scored (needs ≥2 providers).
 */
export function dataConfidence(ds: CompanyDataset, indicators: Indicator[], now = new Date()): DataConfidence {
  const coverageRaw = indicators.length ? indicators.filter((i) => i.score !== null).length / indicators.length : 0
  const latest = ds.annual[ds.annual.length - 1]
  const ageDays = latest ? (now.getTime() - new Date(latest.periodEnd + 'T00:00:00Z').getTime()) / 86400_000 : 9999
  const freshness = interpolate(ageDays, [90, 365, 540, 900], [100, 85, 60, 30])
  const usedSources = new Set(indicators.filter((i) => i.score !== null).flatMap((i) => i.sourceIds))
  const tiers = [...usedSources].map((id) => ds.sources[id]?.tier).filter(Boolean) as SourceTier[]
  const reliability = tiers.length ? tiers.reduce((s, t) => s + TIER_RELIABILITY[t], 0) / tiers.length : 0
  const depth = Math.min(ds.annual.length / 10, 1) * 100

  const components: ConfidenceComponent[] = [
    { key: 'coverage', label: 'Metric coverage', score: coverageRaw * 100, weight: 40, note: `${indicators.filter((i) => i.score !== null).length} of ${indicators.length} indicators have data.` },
    { key: 'freshness', label: 'Data freshness', score: freshness, weight: 20, note: latest ? `Latest fiscal period ended ${latest.periodEnd} (${Math.round(ageDays)} days ago).` : 'No financial periods.' },
    { key: 'reliability', label: 'Source reliability', score: reliability, weight: 25, note: ds.mode === 'demo' ? 'Demo dataset — reliability heavily discounted.' : 'Weighted by source tier (filing > provider > estimate/editorial).' },
    { key: 'depth', label: 'Historical depth', score: depth, weight: 15, note: `${ds.annual.length} fiscal years available (10 = full credit).` },
    { key: 'consensus', label: 'Cross-source consensus', score: null, weight: 0, note: 'Not yet measured — requires two independent providers for the same figures.' },
  ]
  const score = components.reduce((s, c) => s + (c.score ?? 0) * c.weight, 0) / 100
  return { score: Math.round(score), components }
}
