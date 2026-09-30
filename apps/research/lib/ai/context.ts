import type { CompanyAnalysis } from '@/lib/analysis/build'
import { getCompanyDataset } from '@/lib/data/dataset'
import { buildAnalysis } from '@/lib/analysis/build'
import { getUniverse, type UniverseRow } from '@/lib/screener/universe'
import { CATEGORY_LABELS } from '@/lib/scoring/types'

export interface Subject {
  ticker: string
  analysis: CompanyAnalysis | null
  snapshot: UniverseRow | null
}

const NAME_HINTS: Record<string, string> = {
  apple: 'AAPL',
  microsoft: 'MSFT',
  nvidia: 'NVDA',
  amazon: 'AMZN',
  alphabet: 'GOOGL',
  google: 'GOOGL',
  meta: 'META',
  facebook: 'META',
  tesla: 'TSLA',
  'johnson & johnson': 'JNJ',
  'coca-cola': 'KO',
  coca: 'KO',
  costco: 'COST',
}

/** Finds tickers mentioned in a question (explicit symbols or well-known names). */
export function detectTickers(question: string, known: string[]): string[] {
  const out: string[] = []
  const q = question.toLowerCase()
  for (const [name, t] of Object.entries(NAME_HINTS)) if (q.includes(name) && !out.includes(t)) out.push(t)
  for (const m of question.matchAll(/\b[A-Z]{2,5}\b/g)) if (known.includes(m[0]) && !out.includes(m[0])) out.push(m[0])
  return out.slice(0, 5)
}

export async function loadSubjects(tickers: string[]): Promise<Subject[]> {
  const universe = getUniverse()
  return Promise.all(
    tickers.map(async (t) => {
      const ds = await getCompanyDataset(t).catch(() => null)
      return { ticker: t, analysis: ds ? buildAnalysis(ds) : null, snapshot: universe.find((u) => u.ticker === t) ?? null }
    }),
  )
}

const r1 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10) / 10)

/**
 * Compact, grounded context for the model: only computed figures with their
 * provenance. The model is instructed to use nothing else.
 */
export function buildContext(subjects: Subject[]): string {
  const docs = subjects.map((s) => {
    const a = s.analysis
    if (!a) {
      return s.snapshot
        ? { ticker: s.ticker, coverage: 'snapshot-only (headline metrics; no full dataset)', dataMode: 'demo', snapshot: { ...s.snapshot, scores: s.snapshot.scores } }
        : { ticker: s.ticker, coverage: 'none — data unavailable' }
    }
    const ds = a.dataset
    return {
      ticker: s.ticker,
      name: ds.profile.name,
      dataMode: ds.mode,
      dataNote: ds.mode === 'demo' ? 'DEMO DATA — illustrative, not verified against filings. Say so when citing figures.' : 'Sourced from connected providers.',
      sources: Object.values(ds.sources).map((x) => ({ id: x.id, name: x.name, period: x.period, updated: x.updated })),
      profile: { sector: ds.profile.sector, industry: ds.profile.industry, description: ds.profile.description, ceo: ds.profile.ceo, ceoSince: ds.profile.ceoSince },
      investmentQualityScore: { score: a.overall.score, signal: a.overall.signal, dataConfidence: a.confidence.score, meaning: 'Strength of evidence under the platform methodology; NOT a probability of price rise.' },
      categoryScores: Object.fromEntries(a.categories.map((c) => [CATEGORY_LABELS[c.key], c.score])),
      labels: { ...a.labels, moat: a.moat.rating, moatScore: a.moat.score },
      annual: ds.annual.map((y, i) => ({
        fy: y.fiscalYear,
        revenue: y.revenue,
        operatingIncome: y.operatingIncome,
        netIncome: y.netIncome,
        eps: y.epsDiluted,
        fcf: y.freeCashFlow,
        totalDebt: y.totalDebt,
        cashAndSTInvestments: (y.cash ?? 0) + (y.shortTermInvestments ?? 0),
        equity: y.equity,
        shares: y.sharesDiluted,
        grossMarginPct: r1(a.fp.years[i].grossMargin),
        operatingMarginPct: r1(a.fp.years[i].operatingMargin),
        roicPct: r1(a.fp.years[i].roic),
        roePct: r1(a.fp.years[i].roe),
        investedCapital: a.fp.years[i].investedCapital,
        netDebtToEbitda: r1(a.fp.years[i].netDebtToEbitda),
        pe: r1(a.fp.years[i].pe),
      })),
      growth: a.fp.growth,
      growthTrend: { revenue: a.fp.revenueTrend, eps: a.fp.epsTrend },
      valuation: a.valuation,
      multiplesVsReferences: a.multiples.map((m) => ({ multiple: m.label, current: r1(m.current), avg5: r1(m.avg5), avg10: r1(m.avg10), industry: r1(m.industry), peerMedian: r1(m.peerMedian), premiumPct: r1(m.premiumPct) })),
      dcf: a.dcf.map((d) => ({ case: d.name, assumptions: d.inputs, fairValuePerShare: r1(d.result.perShare), marginOfSafetyPct: r1(d.marginOfSafety) })),
      reverseDcfImpliedFcfGrowthPct: r1(a.impliedGrowth),
      scenarios5y: a.scenarios.map((s) => ({ name: s.name, assumptions: { revenueCagr: s.revenueCagr, operatingMargin: s.operatingMargin, exitPe: [s.exitPeLow, s.exitPeHigh] }, revenue: s.revenue, eps: r1(s.eps), valueRange: [r1(s.valueLow), r1(s.valueHigh)] })),
      strengths: a.strengths.map((i) => `${i.label}: ${i.display} — ${i.rationale}`),
      concerns: a.concerns.map((i) => `${i.label}: ${i.display} — ${i.rationale}`),
      topRisks: a.topRisks.map((i) => `${i.label}: ${i.display} — ${i.rationale}`),
      indicators: a.indicators.filter((i) => i.score !== null).map((i) => ({ id: i.id, label: i.label, value: i.display, score: i.score, rating: i.rating })),
      unavailable: a.indicators.filter((i) => i.score === null).map((i) => i.label),
      frameworks: a.frameworks.map((f) => ({ name: f.name, score: f.score, classification: f.classification?.label })),
      qualitative: ds.qualitative
        ? { moat: ds.qualitative.moat, risks: ds.qualitative.risks, industry: ds.qualitative.industry, outlook: ds.qualitative.outlook, cyclicality: ds.qualitative.cyclicality, macro: ds.qualitative.macroSensitivities }
        : 'No reviewed editorial profile.',
      analystEstimates: ds.estimates ? { ...ds.estimates, note: 'Third-party estimates, not the platform’s forecast.' } : null,
    }
  })
  return JSON.stringify(docs)
}
