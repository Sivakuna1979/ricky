import type { CompanyDataset, Num } from '@/lib/domain/types'
import type { FinancialProfile } from '@/lib/finance/metrics'
import { grahamNumber, type CurrentValuation } from '@/lib/finance/valuation'
import { cagr, interpolate, isNum, mean, sumLoose } from '@/lib/finance/stats'
import { fmtMoney, fmtPct, fmtPrice, fmtX, NA } from '@/lib/format'
import type { CategoryScore, Indicator } from './types'
import { categoryScore } from './engine'

export type CriterionStatus = 'pass' | 'partial' | 'fail' | 'na' | 'unavailable'

export interface Criterion {
  label: string
  value: string
  status: CriterionStatus
  note: string
}

export interface FrameworkResult {
  key: 'graham' | 'buffett' | 'fisher' | 'lynch' | 'greenblatt' | 'munger'
  name: string
  scoreLabel: string
  score: number | null
  classicScore?: number | null
  criteria: Criterion[]
  summary: string
  caveats: string[]
  classification?: { label: string; reason: string }
  figures?: { label: string; value: string }[]
}

const PTS: Record<CriterionStatus, number | null> = { pass: 1, partial: 0.5, fail: 0, na: null, unavailable: null }

function scoreOf(criteria: Criterion[]): number | null {
  const s = criteria.map((c) => PTS[c.status]).filter((x): x is number => x !== null)
  return s.length ? Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 100) : null
}

const st = (v: Num, pass: (x: number) => boolean, partial?: (x: number) => boolean): CriterionStatus =>
  !isNum(v) ? 'unavailable' : pass(v) ? 'pass' : partial && partial(v) ? 'partial' : 'fail'

interface Ctx {
  ds: CompanyDataset
  fp: FinancialProfile
  val: CurrentValuation
  categories: CategoryScore[]
  indicators: Indicator[]
  moatScore: Num
}

export function graham({ ds, fp, val }: Ctx): FrameworkResult {
  const a = fp.latestAnnual
  const annual = ds.annual
  const eps3 = (from: number) => mean(annual.slice(from, from + 3).map((y) => y.epsDiluted))
  const epsStart = eps3(0)
  const epsEnd = mean(annual.slice(-3).map((y) => y.epsDiluted))
  const epsGrowth = isNum(epsStart) && isNum(epsEnd) && epsStart > 0 ? (epsEnd / epsStart - 1) * 100 : null
  const pe3 = isNum(val.price) && isNum(epsEnd) && epsEnd > 0 ? val.price / epsEnd : null
  const nca = isNum(a.currentAssets) && isNum(a.currentLiabilities) ? a.currentAssets - a.currentLiabilities : null
  const gn = grahamNumber(a.epsDiluted, val.bookValuePerShare)
  const assetLight = isNum(val.pb) && val.pb > 10 && isNum(fp.latest.roic) && fp.latest.roic > 25
  const debtToAssets = isNum(a.totalDebt) && isNum(a.totalAssets) ? (a.totalDebt / a.totalAssets) * 100 : null
  const allProfitable = annual.every((y) => isNum(y.netIncome) && y.netIncome > 0)
  const divYears = annual.filter((y) => isNum(y.dividendsPaid) && y.dividendsPaid > 0).length

  const peXpb = isNum(val.pe) && isNum(val.pb) ? val.pe * val.pb : null
  const pbStatus: CriterionStatus = !isNum(val.pb) ? 'unavailable' : val.pb <= 1.5 || (isNum(peXpb) && peXpb <= 22.5) ? 'pass' : 'fail'
  const gnStatus: CriterionStatus = !isNum(gn) || !isNum(val.price) ? 'unavailable' : val.price <= gn ? 'pass' : 'fail'

  const criteria: Criterion[] = [
    { label: 'Adequate size', value: fmtMoney(a.revenue, ds.profile.currency), status: st(a.revenue, (x) => x >= 2e9), note: 'Revenue ≥ $2B (modernised version of Graham’s size test).' },
    { label: 'Strong current ratio (≥ 2)', value: fmtX(fp.latest.currentRatio, 2), status: st(fp.latest.currentRatio, (x) => x >= 2, (x) => x >= 1.5), note: 'Graham wanted current assets at least twice current liabilities.' },
    { label: 'Long-term debt < net current assets', value: `${fmtMoney(a.longTermDebt)} vs ${fmtMoney(nca)}`, status: isNum(a.longTermDebt) && isNum(nca) ? (a.longTermDebt < nca ? 'pass' : 'fail') : 'unavailable', note: 'Debt should be covered by working capital.' },
    { label: 'Debt relative to assets (≤ 50%)', value: fmtPct(debtToAssets), status: st(debtToAssets, (x) => x <= 50), note: 'Total debt ÷ total assets.' },
    { label: 'Earnings stability', value: allProfitable ? `Profitable in all ${annual.length} years` : 'Loss in at least one year', status: allProfitable ? 'pass' : 'fail', note: 'Positive earnings each year (Graham asked for 10).' },
    { label: 'Dividend record', value: `${divYears} of ${annual.length} years`, status: divYears === annual.length ? 'pass' : divYears > 0 ? 'partial' : 'fail', note: 'Uninterrupted dividends (Graham asked for 20 years; limited to available history).' },
    { label: 'Earnings growth (≥ 33% over the period)', value: fmtPct(epsGrowth, 0, true), status: st(epsGrowth, (x) => x >= 33, (x) => x > 0), note: '3-yr average EPS at end vs start of the dataset.' },
    { label: 'Moderate P/E (≤ 15 on 3-yr avg EPS)', value: fmtX(pe3), status: st(pe3, (x) => x <= 15, (x) => x <= 20), note: 'Price ÷ average EPS of the last three years.' },
    {
      label: 'Moderate P/B (≤ 1.5, or P/E × P/B ≤ 22.5)',
      value: `${fmtX(val.pb)} · P/E×P/B ${isNum(peXpb) ? peXpb.toFixed(0) : NA}`,
      status: assetLight ? 'na' : pbStatus,
      note: assetLight ? 'Not applied: asset-light business with very high ROIC — book value understates the economic capital (brands, software, ecosystems are not on the balance sheet).' : 'Price relative to book value.',
    },
    {
      label: 'Price ≤ Graham Number',
      value: `${fmtPrice(gn)} vs price ${fmtPrice(val.price)}`,
      status: assetLight ? 'na' : gnStatus,
      note: assetLight ? 'Not applied for the same asset-light reason (the formula relies on book value).' : '√(22.5 × EPS × book value per share).',
    },
  ]
  const classic = scoreOf(criteria.map((c) => (c.status === 'na' ? { ...c, status: c.label.startsWith('Moderate P/B') ? pbStatus : gnStatus } : c)))
  return {
    key: 'graham',
    name: 'Benjamin Graham principles',
    scoreLabel: 'Graham Principles Score',
    score: scoreOf(criteria),
    classicScore: classic,
    criteria,
    summary:
      'Inspired by the defensive-investor tests in The Intelligent Investor: size, liquidity, earnings stability, dividends, growth and a moderate price with a margin of safety.',
    caveats: [
      'Graham’s tests were designed for asset-heavy industrial companies of the mid-20th century.',
      'Modern asset-light businesses (software, platforms, brands) often fail book-value tests while earning very high returns. Where that is the case, those criteria are marked “not applied” and the unadjusted classic score is shown separately.',
    ],
    figures: [
      { label: 'Graham Number', value: fmtPrice(gn) },
      { label: 'Earnings yield (EPS/price)', value: fmtPct(val.peEarningsYield, 2) },
      { label: 'Book value / share', value: fmtPrice(val.bookValuePerShare) },
    ],
  }
}

export function buffett({ fp, val, moatScore, ds }: Ctx): FrameworkResult {
  const ys = fp.years
  const roeYears = ys.filter((y) => isNum(y.roe))
  const roeHigh = roeYears.filter((y) => (y.roe as number) >= 15).length
  const a = fp.latestAnnual
  const debtYears = isNum(a.longTermDebt) && isNum(a.netIncome) && a.netIncome > 0 ? a.longTermDebt / a.netIncome : null
  const criteria: Criterion[] = [
    { label: 'High ROE, consistently (≥ 15% in 80% of years)', value: `${roeHigh} of ${roeYears.length} years`, status: roeYears.length ? (roeHigh / roeYears.length >= 0.8 ? 'pass' : roeHigh / roeYears.length >= 0.5 ? 'partial' : 'fail') : 'unavailable', note: 'Check whether leverage or buybacks inflate ROE (see Debt/Equity).' },
    { label: 'High ROIC (≥ 15%)', value: fmtPct(fp.latest.roic), status: st(fp.latest.roic, (x) => x >= 15, (x) => x >= 10), note: 'Returns on all capital, not just equity.' },
    { label: 'Predictable earnings (≤ 2 down years)', value: `${fp.netIncomeDownYears} down years`, status: fp.netIncomeDownYears <= 2 ? 'pass' : fp.netIncomeDownYears <= 4 ? 'partial' : 'fail', note: 'Years in which net income fell.' },
    { label: 'Strong free cash flow (margin ≥ 15%)', value: fmtPct(fp.latest.fcfMargin), status: st(fp.latest.fcfMargin, (x) => x >= 15, (x) => x >= 8), note: '' },
    { label: 'Low reliance on debt (LT debt ≤ 4× net income)', value: fmtX(debtYears), status: st(debtYears, (x) => x <= 4, (x) => x <= 6), note: 'Years of earnings needed to repay long-term debt.' },
    { label: 'Pricing power (gross margin ≥ 40%)', value: fmtPct(fp.latest.grossMargin), status: st(fp.latest.grossMargin, (x) => x >= 40, (x) => x >= 30), note: '' },
    { label: 'Durable competitive advantage (moat ≥ 70)', value: isNum(moatScore) ? `${moatScore}/100` : NA, status: st(moatScore, (x) => x >= 70, (x) => x >= 55), note: 'From the Moat score (qualitative + quantitative).' },
    { label: 'Shareholder-friendly capital allocation', value: fmtPct(cagr(ds.annual[Math.max(0, ds.annual.length - 6)]?.sharesDiluted, a.sharesDiluted, Math.min(5, ds.annual.length - 1)), 1, true) + ' shares/yr', status: st(cagr(ds.annual[Math.max(0, ds.annual.length - 6)]?.sharesDiluted, a.sharesDiluted, Math.min(5, ds.annual.length - 1)), (x) => x <= -0.5, (x) => x <= 1), note: 'Falling share count through buybacks.' },
    { label: 'Long-term growth runway', value: fmtPct(fp.growth.revenue.y10, 1, true) + ' 10-yr revenue CAGR', status: st(fp.growth.revenue.y10, (x) => x >= 7, (x) => x >= 3), note: '' },
    { label: 'Sensible price (FCF yield ≥ 5%)', value: fmtPct(val.fcfYield, 2), status: st(val.fcfYield, (x) => x >= 5, (x) => x >= 3), note: 'A wonderful business can still be a poor investment at too high a price.' },
  ]
  return {
    key: 'buffett',
    name: 'Buffett-style quality analysis',
    scoreLabel: 'Buffett-Style Quality Score',
    score: scoreOf(criteria),
    criteria,
    summary: 'Characteristics associated with Warren Buffett’s published long-term investing principles: durable advantage, high returns, predictable cash generation, low debt and sensible price.',
    caveats: ['This framework is inspired by publicly available letters and interviews. It does not imply that Warren Buffett or Berkshire Hathaway recommends, owns or endorses this company.'],
  }
}

export function fisher({ fp, ds, categories, moatScore }: Ctx): FrameworkResult {
  const rndNow = fp.latestAnnual.researchAndDevelopment
  const rnd5 = ds.annual[Math.max(0, ds.annual.length - 6)]?.researchAndDevelopment
  const rndCagr = cagr(rnd5, rndNow, Math.min(5, ds.annual.length - 1))
  const opTrend = isNum(fp.latest.operatingMargin) && isNum(fp.avg5.operatingMargin) ? fp.latest.operatingMargin - fp.avg5.operatingMargin : null
  const mg = categoryScore(categories, 'management')
  const q = ds.qualitative
  const criteria: Criterion[] = [
    { label: 'Long-term sales growth (5-yr CAGR ≥ 10%)', value: fmtPct(fp.growth.revenue.y5, 1, true), status: st(fp.growth.revenue.y5, (x) => x >= 10, (x) => x >= 5), note: '' },
    { label: 'Research & development intensity (≥ 5% of revenue)', value: fmtPct(fp.latest.rndToRevenue), status: st(fp.latest.rndToRevenue, (x) => x >= 5, (x) => x >= 2), note: 'Investment in future products.' },
    { label: 'R&D growth (5-yr CAGR ≥ revenue growth)', value: fmtPct(rndCagr, 1, true), status: isNum(rndCagr) && isNum(fp.growth.revenue.y5) ? (rndCagr >= fp.growth.revenue.y5 ? 'pass' : 'partial') : 'unavailable', note: 'Is innovation spending keeping pace with the business?' },
    { label: 'Worthwhile profit margins (operating ≥ 20%)', value: fmtPct(fp.latest.operatingMargin), status: st(fp.latest.operatingMargin, (x) => x >= 20, (x) => x >= 10), note: '' },
    { label: 'Improving margins', value: opTrend === null ? NA : `${opTrend >= 0 ? '+' : ''}${opTrend.toFixed(1)} pp vs 5-yr avg`, status: st(opTrend, (x) => x >= 0, (x) => x >= -2), note: '' },
    { label: 'Competitive position (moat ≥ 70)', value: isNum(moatScore) ? `${moatScore}/100` : NA, status: st(moatScore, (x) => x >= 70, (x) => x >= 55), note: '' },
    { label: 'Management & capital allocation (score ≥ 65)', value: mg === null ? NA : `${mg}/100`, status: st(mg, (x) => x >= 65, (x) => x >= 50), note: 'Measured from capital allocation data only.' },
    { label: 'Market opportunity', value: q ? ['', 'Limited', 'Moderate', 'Large'][q.marketOpportunity] : NA, status: q ? (q.marketOpportunity === 3 ? 'pass' : q.marketOpportunity === 2 ? 'partial' : 'fail') : 'unavailable', note: 'Editorial assessment of remaining runway.' },
    { label: 'Long-term potential (consensus LT EPS growth ≥ 10%)', value: fmtPct(ds.estimates?.longTermEpsGrowth), status: st(ds.estimates?.longTermEpsGrowth ?? null, (x) => x >= 10, (x) => x >= 6), note: 'Third-party estimate.' },
  ]
  return {
    key: 'fisher',
    name: 'Philip Fisher growth quality',
    scoreLabel: 'Fisher Growth Quality Score',
    score: scoreOf(criteria),
    criteria,
    summary: 'Concepts associated with Common Stocks and Uncommon Profits: sustained sales growth, innovation, margins, competitive position and management quality.',
    caveats: ['Fisher relied heavily on qualitative “scuttlebutt” research; only the measurable parts are scored here.'],
  }
}

export function lynch({ fp, val, ds }: Ctx): FrameworkResult {
  const a = fp.latestAnnual
  const epsG = fp.growth.eps.y5
  const revG = fp.growth.revenue.y5
  const g = mean([epsG, revG])
  const q = ds.qualitative
  const hadLoss = ds.annual.slice(0, -1).some((y) => isNum(y.netIncome) && y.netIncome < 0)
  const netCash = isNum(val.netDebt) ? -val.netDebt : null
  let cls = { label: 'Unclassified', reason: 'Insufficient growth history.' }
  if (hadLoss && isNum(a.netIncome) && a.netIncome > 0) cls = { label: 'Turnaround', reason: 'Returned to profit after losses within the dataset.' }
  else if (q?.cyclicality === 'highly_cyclical') cls = { label: 'Cyclical', reason: q.cyclicalityReason }
  else if (isNum(val.pb) && val.pb < 1 && isNum(netCash) && isNum(val.marketCap) && netCash > 0.3 * val.marketCap) cls = { label: 'Asset Play', reason: 'Trades below book value with substantial net cash.' }
  else if (isNum(g)) {
    if (g >= 20) cls = { label: 'Fast Grower', reason: `Blended 5-yr EPS/revenue growth of ${g.toFixed(1)}% per year (≥ 20%).` }
    else if (g >= 8) cls = { label: 'Stalwart', reason: `Large, established company growing ~${g.toFixed(1)}% per year (blend of ${fmtPct(epsG)} EPS and ${fmtPct(revG)} revenue CAGR) — between slow growers and fast growers.` }
    else cls = { label: 'Slow Grower', reason: `Blended growth of ${g.toFixed(1)}% per year (< 8%).` }
  }
  const growthForRatio = val.pegGrowthBasis.startsWith('consensus') ? ds.estimates?.longTermEpsGrowth ?? epsG : epsG
  const lynchRatio = isNum(growthForRatio) && isNum(val.pe) ? (growthForRatio + (val.dividendYield ?? 0)) / val.pe : null
  const invG = (() => {
    const p = ds.annual[ds.annual.length - 2]
    return p && isNum(p.inventory) && isNum(a.inventory) && p.inventory > 0 ? (a.inventory / p.inventory - 1) * 100 : null
  })()
  const criteria: Criterion[] = [
    { label: 'PEG ≤ 1 (≤ 2 partial)', value: fmtX(val.peg, 2), status: st(val.peg, (x) => x <= 1, (x) => x <= 2), note: `P/E ÷ ${val.pegGrowthBasis}.` },
    { label: '(Growth + dividend yield) ÷ P/E ≥ 1.5', value: fmtX(lynchRatio, 2), status: st(lynchRatio, (x) => x >= 1.5, (x) => x >= 1), note: 'Lynch’s dividend-adjusted PEG variant.' },
    { label: 'EPS growth (5-yr) 10–25%', value: fmtPct(epsG, 1, true), status: st(epsG, (x) => x >= 10 && x <= 30, (x) => x > 0), note: 'Very high growth is hard to sustain; low growth limits upside.' },
    { label: 'Manageable debt (net debt/EBITDA ≤ 1)', value: fmtX(fp.latest.netDebtToEbitda, 2), status: st(fp.latest.netDebtToEbitda, (x) => x <= 1, (x) => x <= 2), note: '' },
    { label: 'Inventory not outgrowing sales', value: `${fmtPct(invG, 1, true)} inventory vs ${fmtPct(fp.latest.revenueGrowth, 1, true)} sales`, status: isNum(invG) && isNum(fp.latest.revenueGrowth) ? (invG <= fp.latest.revenueGrowth + 5 ? 'pass' : 'fail') : 'unavailable', note: 'Inventory piling up faster than sales can signal weakening demand.' },
    { label: 'Positive free cash flow', value: fmtMoney(a.freeCashFlow), status: st(a.freeCashFlow, (x) => x > 0), note: '' },
    { label: 'Understandable business', value: q ? ['', 'Complex', 'Moderate', 'Simple'][q.businessSimplicity] : NA, status: q ? (q.businessSimplicity === 3 ? 'pass' : q.businessSimplicity === 2 ? 'partial' : 'fail') : 'unavailable', note: 'Editorial: can the business be explained in two minutes?' },
  ]
  return {
    key: 'lynch',
    name: 'Peter Lynch-style analysis',
    scoreLabel: 'Lynch GARP Score',
    score: scoreOf(criteria),
    criteria,
    classification: cls,
    summary: 'Concepts associated with One Up on Wall Street: classify the company, then judge growth relative to price (PEG), debt, inventory and cash flow.',
    caveats: ['Lynch’s categories are judgement aids; companies can move between them over time.'],
    figures: [{ label: 'Net cash / share', value: isNum(netCash) && isNum(val.shares) ? fmtPrice(netCash / val.shares) : NA }],
  }
}

export function greenblatt({ fp, val }: Ctx): FrameworkResult {
  const a = fp.latestAnnual
  const cashLike = sumLoose(a.cash, a.shortTermInvestments) ?? 0
  const nwc = isNum(a.currentAssets) && isNum(a.currentLiabilities) ? a.currentAssets - cashLike - (a.currentLiabilities - (a.shortTermDebt ?? 0)) : null
  const tangible = isNum(nwc) && isNum(a.netPPE) ? nwc + a.netPPE : null
  const negativeCapital = isNum(tangible) && tangible <= 0
  const roc = negativeCapital ? null : isNum(tangible) && isNum(a.operatingIncome) ? (a.operatingIncome / tangible) * 100 : null
  const eyScore = isNum(val.earningsYield) ? interpolate(val.earningsYield, [3, 6, 10, 15], [15, 45, 75, 95]) : null
  const rocScore = negativeCapital ? 100 : isNum(roc) ? interpolate(roc, [10, 25, 50, 100], [20, 55, 80, 100]) : null
  const score = isNum(eyScore) && isNum(rocScore) ? Math.round((eyScore + rocScore) / 2) : null
  return {
    key: 'greenblatt',
    name: 'Joel Greenblatt Magic Formula',
    scoreLabel: 'Greenblatt Quality/Value Score',
    score,
    criteria: [
      { label: 'Earnings yield = EBIT ÷ EV', value: fmtPct(val.earningsYield, 2), status: st(val.earningsYield, (x) => x >= 8, (x) => x >= 5), note: `Scores ${eyScore === null ? NA : Math.round(eyScore)}/100 (cheapness).` },
      {
        label: 'Return on capital = EBIT ÷ (net working capital + net fixed assets)',
        value: negativeCapital ? 'Very high (tangible capital ≤ 0)' : fmtPct(roc, 0),
        status: negativeCapital ? 'pass' : st(roc, (x) => x >= 25, (x) => x >= 15),
        note: negativeCapital ? 'Suppliers and customers effectively fund working capital, so the business needs almost no tangible capital. Scored as 100.' : `Scores ${rocScore === null ? NA : Math.round(rocScore)}/100 (quality).`,
      },
    ],
    summary: 'Concepts from The Little Book That Beats the Market: rank companies on both high return on capital (quality) and high earnings yield (cheapness). The score is the average of the two components.',
    caveats: ['The original method ranks a whole universe; a single-company score is an approximation until the screener ranks peers.'],
  }
}

export function munger({ ds, fp, indicators, moatScore }: Ctx): FrameworkResult {
  const q = ds.qualitative
  const get = (id: string) => indicators.find((i) => i.id === id)?.score ?? null
  const threatLevels = q?.risks.filter((r) => ['competition', 'disruption'].includes(r.key)).map((r) => r.level) ?? []
  const threat = threatLevels.length ? threatLevels.reduce((s, l) => s + l, 0) / threatLevels.length : null
  const criteria: Criterion[] = [
    { label: 'Business simplicity', value: q ? ['', 'Complex', 'Moderate', 'Simple'][q.businessSimplicity] : NA, status: q ? (q.businessSimplicity === 3 ? 'pass' : q.businessSimplicity === 2 ? 'partial' : 'fail') : 'unavailable', note: '' },
    { label: 'Economic moat', value: isNum(moatScore) ? `${moatScore}/100` : NA, status: st(moatScore, (x) => x >= 70, (x) => x >= 55), note: '' },
    { label: 'Pricing power', value: get('moat.pricing_power') === null ? NA : `${get('moat.pricing_power')}/100`, status: st(get('moat.pricing_power'), (x) => x >= 65, (x) => x >= 45), note: 'Gross margin versus its long-run average.' },
    { label: 'Management incentives (SBC / revenue ≤ 3%)', value: fmtPct(fp.latest.sbcToRevenue), status: st(fp.latest.sbcToRevenue, (x) => x <= 3, (x) => x <= 6), note: 'Measurable proxy only; see proxy statement (DEF 14A) for pay structure.' },
    { label: 'Long-term durability (ROIC persistence)', value: `${fp.roicAbove15Years} yrs ROIC ≥ 15%`, status: fp.years.length ? (fp.roicAbove15Years / fp.years.length >= 0.8 ? 'pass' : fp.roicAbove15Years / fp.years.length >= 0.5 ? 'partial' : 'fail') : 'unavailable', note: '' },
    { label: 'Competitive threats (competition & disruption)', value: threat === null ? NA : ['', 'Low', 'Moderate', 'Elevated', 'High'][Math.round(threat)], status: threat === null ? 'unavailable' : threat <= 1.5 ? 'pass' : threat <= 2.5 ? 'partial' : 'fail', note: 'Editorial risk ratings.' },
    { label: 'Capital efficiency (ROIC ≥ 20%)', value: fmtPct(fp.latest.roic), status: st(fp.latest.roic, (x) => x >= 20, (x) => x >= 12), note: '' },
    {
      label: 'Ability to compound internally',
      value: fmtPct(fp.latest.capexToRevenue) + ' capex/revenue',
      status: 'partial',
      note: 'High returns but limited reinvestment need: most cash is returned to shareholders rather than compounded inside the business. Neutral by design.',
    },
  ]
  return {
    key: 'munger',
    name: 'Charlie Munger-style business quality',
    scoreLabel: 'Munger Business Quality Score',
    score: scoreOf(criteria),
    criteria,
    summary: 'Ideas associated with Poor Charlie’s Almanack: understandable businesses with durable moats, pricing power, aligned incentives and high returns on capital — bought at a fair price.',
    caveats: ['Several inputs are editorial and marked as such. This is not an endorsement by any individual.'],
  }
}

export function runFrameworks(ctx: Ctx): FrameworkResult[] {
  return [graham(ctx), buffett(ctx), fisher(ctx), lynch(ctx), greenblatt(ctx), munger(ctx)]
}
