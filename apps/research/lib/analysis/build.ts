import type { CompanyDataset, Num } from '@/lib/domain/types'
import { computeFinancialProfile, dilutionProfile, type FinancialProfile } from '@/lib/finance/metrics'
import { compareMultiples, computeCurrentValuation, type CurrentValuation, type MultipleComparison } from '@/lib/finance/valuation'
import { impliedGrowth, marginOfSafety, runDcf, type DcfInputs, type DcfResult } from '@/lib/finance/dcf'
import { technicalSnapshot, type TechnicalSnapshot } from '@/lib/finance/technical'
import { runScenario, type ScenarioAssumptions, type ScenarioResult } from '@/lib/finance/scenarios'
import { clamp, interpolate, isNum, mean } from '@/lib/finance/stats'
import { buildIndicators, moatRubricScore } from '@/lib/scoring/indicators'
import { balanceSheetLabel, categoryScore, countSignals, moatRating, riskLevel, scoreCategories, scoreOverall, valuationLabel } from '@/lib/scoring/engine'
import { dataConfidence, type DataConfidence } from '@/lib/scoring/confidence'
import { runFrameworks, type FrameworkResult } from '@/lib/scoring/frameworks'
import { buildChecklist } from '@/lib/scoring/checklist'
import type { CategoryScore, Indicator, OverallScore, SignalCounts } from '@/lib/scoring/types'

export interface DcfCase {
  name: 'Bear' | 'Base' | 'Bull'
  inputs: DcfInputs
  result: DcfResult
  marginOfSafety: Num
}

export interface PerformanceRow {
  label: string
  value: Num
}

export interface CompanyAnalysis {
  dataset: CompanyDataset
  chartPrices: { date: string; close: number }[]
  fp: FinancialProfile
  valuation: CurrentValuation
  multiples: MultipleComparison[]
  technical: TechnicalSnapshot | null
  dilution: ReturnType<typeof dilutionProfile>
  dcf: DcfCase[]
  impliedGrowth: Num
  scenarios: ScenarioResult[]
  indicators: Indicator[]
  categories: CategoryScore[]
  overall: OverallScore
  signals: SignalCounts
  confidence: DataConfidence
  frameworks: FrameworkResult[]
  checklist: ReturnType<typeof buildChecklist>
  moat: { score: Num; rating: string | null; qualitative: Num; quantitative: Num }
  labels: { valuation: string | null; balanceSheet: string | null; risk: string | null }
  dividendSafety: Num
  futureOpportunity: Num
  futureRisk: Num
  strengths: Indicator[]
  concerns: Indicator[]
  topRisks: Indicator[]
  performance: PerformanceRow[]
}

function downsample<T>(arr: T[], every: number): T[] {
  const out = arr.filter((_, i) => i % every === 0)
  if (arr.length && out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1])
  return out
}

function dcfCases(fp: FinancialProfile, val: CurrentValuation, ds: CompanyDataset): DcfCase[] {
  const a = fp.latestAnnual
  if (!isNum(a.freeCashFlow) || a.freeCashFlow <= 0 || !isNum(val.shares) || !isNum(val.netDebt) || !isNum(val.price)) return []
  const baseG = clamp(mean([fp.growth.fcf.y5, ds.estimates?.longTermEpsGrowth ?? null, fp.growth.revenue.y5]) ?? 5, -5, 20)
  const common = {
    method: 'fcf' as const,
    currentFcf: a.freeCashFlow,
    currentRevenue: a.revenue ?? 0,
    operatingMargin: fp.latest.operatingMargin ?? 20,
    taxRate: fp.latest.taxRate ?? 21,
    fcfConversion: clamp(((fp.latest.fcf ?? 0) / Math.max(1, (a.operatingIncome ?? 1) * (1 - (fp.latest.taxRate ?? 21) / 100))) * 100, 50, 130),
    netDebt: val.netDebt,
    shares: val.shares,
  }
  const mk = (name: DcfCase['name'], g: number, wacc: number, tg: number): DcfCase => {
    const inputs: DcfInputs = { ...common, fcfGrowth: Math.round(g * 10) / 10, revenueGrowth: Math.round(g * 10) / 10, wacc, terminalGrowth: tg }
    const result = runDcf(inputs)
    return { name, inputs, result, marginOfSafety: result.valid ? marginOfSafety(result.perShare, val.price as number) : null }
  }
  return [mk('Bear', Math.max(baseG - 4, -5), 10, 2), mk('Base', baseG, 9, 2.5), mk('Bull', baseG + 4, 8.5, 3)]
}

function scenarios(fp: FinancialProfile, val: CurrentValuation, ds: CompanyDataset, dilutionRate: Num): ScenarioResult[] {
  const a = fp.latestAnnual
  if (!isNum(a.revenue) || !isNum(val.shares) || !isNum(val.price)) return []
  const fwd = ds.estimates && isNum(ds.estimates.revenueNextFY) ? (ds.estimates.revenueNextFY / a.revenue - 1) * 100 : null
  const g = clamp(mean([fp.growth.revenue.y5, fp.growth.revenue.y3, fwd]) ?? 3, -5, 25)
  const m = fp.latest.operatingMargin ?? 10
  const tax = fp.latest.taxRate ?? 21
  const sh = clamp(dilutionRate ?? 0, -4, 5)
  const f = fp.latest.fcfMargin ?? m * 0.7
  const pe = clamp(fp.avg10.pe ?? fp.avg5.pe ?? 18, 8, 40)
  const r1 = (x: number) => Math.round(x * 10) / 10
  const list: ScenarioAssumptions[] = [
    {
      name: 'Bear', revenueCagr: r1(Math.max(g - 4, -5)), operatingMargin: r1(m - 4), taxRate: r1(tax), shareChangePerYear: r1(sh + 1), fcfMargin: r1(f - 3),
      exitPeLow: Math.round(pe * 0.7 - 3), exitPeHigh: Math.round(pe * 0.7 + 3),
      narrative: ['Growth slows below its recent trend', 'Operating margin contracts by ~4 points', 'Buybacks slow', 'Valuation multiple falls ~30% below its 10-year average'],
    },
    {
      name: 'Base', revenueCagr: r1(g), operatingMargin: r1(m), taxRate: r1(tax), shareChangePerYear: r1(sh), fcfMargin: r1(f),
      exitPeLow: Math.round(pe - 3), exitPeHigh: Math.round(pe + 3),
      narrative: ['Revenue grows in line with its blended 3/5-year trend and consensus', 'Margins hold at current levels', 'Share count continues its 5-year trend', 'Multiple returns to around its 10-year average'],
    },
    {
      name: 'Bull', revenueCagr: r1(g + 3), operatingMargin: r1(m + 2), taxRate: r1(tax), shareChangePerYear: r1(sh - 0.5), fcfMargin: r1(f + 2),
      exitPeLow: Math.round(pe * 1.15 - 3), exitPeHigh: Math.round(pe * 1.15 + 3),
      narrative: ['Strong execution and favourable industry conditions lift growth', 'Mix shift expands margins by ~2 points', 'Buybacks continue', 'Multiple ~15% above its 10-year average'],
    },
  ]
  return list.map((s) => runScenario(s, { revenue: a.revenue as number, shares: val.shares as number, price: val.price as number }))
}

function performance(ds: CompanyDataset): PerformanceRow[] {
  const p = ds.prices
  if (!p.length) return []
  const last = p[p.length - 1]
  const lastDate = new Date(last.date + 'T00:00:00Z')
  const back = (days: number) => {
    const t = new Date(lastDate.getTime() - days * 86400_000).toISOString().slice(0, 10)
    const hit = [...p].reverse().find((x) => x.date <= t)
    return hit && hit.date >= p[0].date && hit !== p[p.length - 1] ? (last.close / hit.close - 1) * 100 : null
  }
  const ytdStart = [...p].reverse().find((x) => x.date < `${lastDate.getUTCFullYear()}-01-01`)
  return [
    { label: '1 month', value: back(30) },
    { label: '6 months', value: back(182) },
    { label: 'YTD', value: ytdStart ? (last.close / ytdStart.close - 1) * 100 : null },
    { label: '1 year', value: back(365) },
    { label: '3 years (total)', value: back(365 * 3) },
    { label: '5 years (total)', value: back(365 * 5) },
    { label: '10 years (total)', value: p.length > 2400 ? (last.close / p[0].close - 1) * 100 : null },
  ]
}

export function buildAnalysis(ds: CompanyDataset): CompanyAnalysis | null {
  const fp = computeFinancialProfile(ds)
  if (!fp) return null
  const valuation = computeCurrentValuation(ds, fp)
  const multiples = compareMultiples(ds, fp, valuation)
  const technical = ds.prices.length >= 60 && ds.pricesInterval !== 'weekly' ? technicalSnapshot(ds.prices) : null
  const dilution = dilutionProfile(ds.annual)
  const dcf = dcfCases(fp, valuation, ds)
  const base = dcf.find((d) => d.name === 'Base')
  const moatQual = moatRubricScore(ds)

  const indicators = buildIndicators({
    ds,
    fp,
    val: valuation,
    multiples,
    tech: technical,
    dcfMarginOfSafety: base?.marginOfSafety ?? null,
    moatQualitative: moatQual,
    dilution,
  })
  const categories = scoreCategories(indicators)
  const overall = scoreOverall(categories, 'balanced')

  const moatQuantInds = indicators.filter((i) => i.category === 'business_quality' && !i.qualitative && i.score !== null)
  const moatQuant = moatQuantInds.length ? Math.round(moatQuantInds.reduce((s, i) => s + (i.score as number) * i.weight, 0) / moatQuantInds.reduce((s, i) => s + i.weight, 0)) : null
  const moatScore = isNum(moatQual) && isNum(moatQuant) ? Math.round(moatQual * 0.6 + moatQuant * 0.4) : moatQual ?? moatQuant

  const frameworks = runFrameworks({ ds, fp, val: valuation, categories, indicators, moatScore })

  const byId = (id: string) => indicators.find((i) => i.id === id)?.score ?? null
  const divInds = ['div.payout', 'div.fcf_payout'].map(byId)
  const dividendSafety = divInds.every((x) => x === null)
    ? null
    : Math.round(mean([...divInds, categoryScore(categories, 'financial_strength'), byId('cf.fcf_consistency')]) ?? 0)

  const q = ds.qualitative
  const futureOpportunity = (() => {
    const parts: Num[] = [
      categoryScore(categories, 'growth'),
      byId('growth.fwd_revenue'),
      byId('growth.fwd_eps'),
      isNum(fp.latest.rndToRevenue) ? interpolate(fp.latest.rndToRevenue, [0, 3, 8, 15], [30, 50, 75, 90]) : null,
      q ? { 1: 30, 2: 60, 3: 90 }[q.marketOpportunity] : null,
      moatScore,
    ]
    const m = mean(parts)
    return m === null ? null : Math.round(m)
  })()
  const riskScore = categoryScore(categories, 'risk')
  const futureRisk = riskScore === null ? null : Math.round(100 - (riskScore * 0.7 + (byId('risk.valuation') ?? riskScore) * 0.3))

  const contribution = new Map(overall.contributions.map((c) => [c.indicatorId, c.points]))
  const ranked = indicators.filter((i) => i.score !== null && i.category !== 'technical' && i.category !== 'dividend')
  const strengths = [...ranked]
    .filter((i) => i.rating === 'positive' || i.rating === 'strong_positive')
    .sort((a, b) => (contribution.get(b.id) ?? 0) - (contribution.get(a.id) ?? 0))
    .slice(0, 5)
  const concerns = [...ranked]
    .filter((i) => i.rating === 'negative' || i.rating === 'strong_negative')
    .sort((a, b) => (contribution.get(a.id) ?? 0) - (contribution.get(b.id) ?? 0))
    .slice(0, 5)
  const topRisks = indicators
    .filter((i) => i.category === 'risk' && i.score !== null)
    .sort((a, b) => (a.score as number) - (b.score as number) || b.weight - a.weight)
    .slice(0, 5)

  return {
    dataset: ds,
    chartPrices: downsample(ds.prices, ds.pricesInterval === 'weekly' ? 1 : 5).map((p) => ({ date: p.date, close: p.close })),
    fp,
    valuation,
    multiples,
    technical,
    dilution,
    dcf,
    impliedGrowth: base && isNum(valuation.price) ? impliedGrowth(base.inputs, valuation.price) : null,
    scenarios: scenarios(fp, valuation, ds, dilution.rate5),
    indicators,
    categories,
    overall,
    signals: countSignals(indicators),
    confidence: dataConfidence(ds, indicators),
    frameworks,
    checklist: buildChecklist(indicators),
    moat: { score: moatScore, rating: moatRating(moatScore), qualitative: moatQual, quantitative: moatQuant },
    labels: {
      valuation: valuationLabel(categoryScore(categories, 'valuation')),
      balanceSheet: balanceSheetLabel(categoryScore(categories, 'financial_strength')),
      risk: riskLevel(riskScore),
    },
    dividendSafety,
    futureOpportunity,
    futureRisk,
    strengths,
    concerns,
    topRisks,
    performance: performance(ds),
  }
}
