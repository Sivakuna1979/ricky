import type { CompanyDataset, Num, RiskKey } from '@/lib/domain/types'
import type { FinancialProfile } from '@/lib/finance/metrics'
import type { CurrentValuation, MultipleComparison } from '@/lib/finance/valuation'
import type { TechnicalSnapshot } from '@/lib/finance/technical'
import { interpolate, isNum, mean } from '@/lib/finance/stats'
import { fmtPct, fmtX, NA } from '@/lib/format'
import { ratingFromScore, type CategoryKey, type Indicator } from './types'

export interface IndicatorContext {
  ds: CompanyDataset
  fp: FinancialProfile
  val: CurrentValuation
  multiples: MultipleComparison[]
  tech: TechnicalSnapshot | null
  dcfMarginOfSafety: Num
  moatQualitative: Num
  dilution: { rate5: Num }
}

type Curve = [number[], number[]]

interface Spec {
  id: string
  category: CategoryKey
  label: string
  value: Num
  display?: string
  curve?: Curve
  score?: number | null
  weight?: number
  why: [string, string, string] // positive, neutral, negative
  basis: string
  sourceIds: string[]
  glossaryKey?: string
  qualitative?: boolean
  cap?: { max: number; reason: string }
}

function make(s: Spec): Indicator {
  let score: number | null = s.score !== undefined ? s.score : isNum(s.value) && s.curve ? interpolate(s.value, s.curve[0], s.curve[1]) : null
  let capNote = ''
  if (score !== null && s.cap && score > s.cap.max) {
    score = s.cap.max
    capNote = ` ${s.cap.reason}`
  }
  if (score !== null) score = Math.round(score)
  const rating = ratingFromScore(score)
  const rationale =
    score === null
      ? 'Data unavailable — this indicator is excluded from the score (not counted as zero) and lowers Data Confidence.'
      : (score >= 65 ? s.why[0] : score >= 45 ? s.why[1] : s.why[2]) + capNote
  return {
    id: s.id,
    category: s.category,
    label: s.label,
    value: s.value,
    display: isNum(s.value) || s.display ? s.display ?? String(s.value) : NA,
    score,
    weight: s.weight ?? 1,
    rating,
    rationale,
    basis: s.basis,
    sourceIds: s.sourceIds,
    glossaryKey: s.glossaryKey,
    qualitative: s.qualitative,
  }
}

const curveText = (c: Curve, unit = '') => c[0].map((x, i) => `${x}${unit}→${c[1][i]}`).join(', ')

const RISK_LABELS: Record<RiskKey, string> = {
  debt: 'Debt risk',
  valuation: 'Valuation risk',
  competition: 'Competition',
  regulation: 'Regulation',
  customer_concentration: 'Customer / product concentration',
  supplier_concentration: 'Supplier concentration',
  currency: 'Currency exposure',
  geopolitical: 'Geopolitical risk',
  disruption: 'Technological disruption',
  key_person: 'Management dependence',
  litigation: 'Litigation',
  cyclicality: 'Cyclicality',
  commodity: 'Commodity exposure',
  interest_rates: 'Interest-rate sensitivity',
  economic_slowdown: 'Economic slowdown',
  dilution: 'Share dilution',
}
export const riskLabel = (k: RiskKey) => RISK_LABELS[k]

/** Risk keys measured quantitatively; their editorial ratings are shown but not double-counted. */
const QUANT_RISKS: RiskKey[] = ['debt', 'valuation', 'dilution', 'cyclicality', 'customer_concentration']

export function buildIndicators(ctx: IndicatorContext): Indicator[] {
  const { ds, fp, val, multiples, tech } = ctx
  const L = fp.latest
  const a = fp.latestAnnual
  const ccy = ds.profile.currency
  const fin = [a.sourceId]
  const ind = ds.industry
  const out: Indicator[] = []
  const add = (s: Spec) => out.push(make(s))

  // ───────────── FINANCIAL STRENGTH ─────────────
  let c: Curve = [[-1, 0, 1, 2, 3, 4.5], [100, 90, 75, 55, 35, 10]]
  add({ id: 'fs.net_debt_ebitda', category: 'financial_strength', label: 'Net debt / EBITDA', value: L.netDebtToEbitda, display: fmtX(L.netDebtToEbitda, 2), curve: c, weight: 2,
    why: ['Net debt is small relative to annual operating earnings — debt could be repaid quickly from cash generation.', 'Leverage is moderate; manageable but worth monitoring.', 'Leverage is high relative to earnings, which reduces flexibility in a downturn.'],
    basis: `(Total debt − cash − short-term investments) ÷ EBITDA. Conservative: excludes long-term investments. Curve: ${curveText(c, '×')}`, sourceIds: fin, glossaryKey: 'netDebtToEbitda' })
  c = [[1.5, 3, 6, 10, 20], [5, 30, 60, 80, 100]]
  add({ id: 'fs.interest_coverage', category: 'financial_strength', label: 'Interest coverage', value: L.interestCoverage, display: fmtX(L.interestCoverage), curve: c,
    why: ['Operating profit covers interest costs many times over.', 'Interest costs are covered, with limited headroom.', 'Operating profit only thinly covers interest costs.'],
    basis: `EBIT ÷ interest expense. Curve: ${curveText(c, '×')}`, sourceIds: fin, glossaryKey: 'interestCoverage' })
  c = [[0.7, 1, 1.5, 2], [30, 50, 75, 90]]
  add({ id: 'fs.current_ratio', category: 'financial_strength', label: 'Current ratio', value: L.currentRatio, display: fmtX(L.currentRatio, 2), curve: c,
    why: ['Short-term assets comfortably exceed short-term liabilities.', 'Short-term assets roughly match short-term liabilities.', 'Current liabilities exceed current assets. For very cash-generative firms with large long-term investment portfolios this is less concerning than for weaker businesses, but it is still flagged.'],
    basis: `Current assets ÷ current liabilities. Curve: ${curveText(c, '×')}`, sourceIds: fin, glossaryKey: 'currentRatio' })
  c = [[0.5, 0.8, 1, 1.5], [30, 50, 65, 85]]
  add({ id: 'fs.quick_ratio', category: 'financial_strength', label: 'Quick ratio', value: L.quickRatio, display: fmtX(L.quickRatio, 2), curve: c,
    why: ['Liquid assets alone cover short-term obligations.', 'Liquid assets cover most short-term obligations.', 'Liquid assets cover less than 80% of short-term obligations.'],
    basis: `(Cash + short-term investments + receivables) ÷ current liabilities. Curve: ${curveText(c, '×')}`, sourceIds: fin, glossaryKey: 'quickRatio' })
  c = [[0.3, 0.8, 1.5, 2.5], [95, 75, 50, 30]]
  add({ id: 'fs.debt_to_equity', category: 'financial_strength', label: 'Debt / equity', value: L.debtToEquity, display: fmtX(L.debtToEquity, 2), curve: c,
    why: ['Debt is low relative to shareholders’ equity.', 'Debt is significant relative to book equity. Large buybacks shrink book equity and can inflate this ratio even when debt is affordable.', 'Debt is high relative to book equity.'],
    basis: `Total debt ÷ shareholders’ equity. Curve: ${curveText(c, '×')}`, sourceIds: fin, glossaryKey: 'debtToEquity' })
  const fcfToDebt = isNum(a.freeCashFlow) && isNum(a.totalDebt) && a.totalDebt > 0 ? a.freeCashFlow / a.totalDebt : null
  c = [[0.1, 0.25, 0.5, 1], [25, 50, 75, 95]]
  add({ id: 'fs.fcf_to_debt', category: 'financial_strength', label: 'FCF / total debt', value: fcfToDebt, display: fmtPct(fcfToDebt === null ? null : fcfToDebt * 100, 0), curve: c, weight: 1.5,
    why: ['One year of free cash flow would repay a large share of all debt.', 'Free cash flow could repay debt within a few years.', 'Debt would take many years of free cash flow to repay.'],
    basis: `Free cash flow ÷ total debt. Curve: ${curveText(c)}`, sourceIds: fin })
  c = [[5, 20, 40, 60], [95, 75, 45, 20]]
  add({ id: 'fs.goodwill', category: 'financial_strength', label: 'Goodwill & intangibles / assets', value: L.goodwillToAssets, display: fmtPct(L.goodwillToAssets), curve: c, weight: 0.5,
    why: ['Little of the balance sheet relies on acquisition goodwill.', 'A meaningful share of assets is goodwill/intangibles.', 'A large share of assets is goodwill/intangibles, which can be written down.'],
    basis: `(Goodwill + intangibles) ÷ total assets. Curve: ${curveText(c, '%')}`, sourceIds: fin })

  // ───────────── PROFITABILITY ─────────────
  const vsInd = (v: Num, i: Num | undefined) => (isNum(v) && isNum(i) ? ` Industry median: ${fmtPct(i)}.` : '')
  c = [[15, 25, 40, 55, 70], [25, 45, 65, 85, 100]]
  add({ id: 'prof.gross_margin', category: 'profitability', label: 'Gross margin', value: L.grossMargin, display: fmtPct(L.grossMargin), curve: c,
    why: ['High gross margin suggests pricing power or a favourable product mix.' + vsInd(L.grossMargin, ind?.grossMargin), 'Gross margin is average.' + vsInd(L.grossMargin, ind?.grossMargin), 'Low gross margin leaves little room for operating costs.' + vsInd(L.grossMargin, ind?.grossMargin)],
    basis: `Gross profit ÷ revenue. Curve: ${curveText(c, '%')}`, sourceIds: fin, glossaryKey: 'grossMargin' })
  c = [[5, 10, 20, 30, 40], [25, 45, 70, 88, 100]]
  add({ id: 'prof.operating_margin', category: 'profitability', label: 'Operating margin', value: L.operatingMargin, display: fmtPct(L.operatingMargin), curve: c, weight: 1.5,
    why: ['The business keeps a large share of each sale as operating profit.' + vsInd(L.operatingMargin, ind?.operatingMargin), 'Operating margin is moderate.' + vsInd(L.operatingMargin, ind?.operatingMargin), 'Thin operating margin — profits are sensitive to cost or price changes.' + vsInd(L.operatingMargin, ind?.operatingMargin)],
    basis: `Operating income ÷ revenue. Curve: ${curveText(c, '%')}`, sourceIds: fin, glossaryKey: 'operatingMargin' })
  c = [[3, 8, 15, 25], [25, 50, 75, 95]]
  add({ id: 'prof.net_margin', category: 'profitability', label: 'Net margin', value: L.netMargin, display: fmtPct(L.netMargin), curve: c,
    why: ['High share of revenue converts into net profit.', 'Net margin is moderate.', 'Low net margin.'],
    basis: `Net income ÷ revenue. Curve: ${curveText(c, '%')}`, sourceIds: fin, glossaryKey: 'netMargin' })
  c = [[5, 8, 12, 20, 30], [15, 40, 60, 85, 100]]
  add({ id: 'prof.roic', category: 'profitability', label: 'Return on invested capital (ROIC)', value: L.roic, display: fmtPct(L.roic), curve: c, weight: 2,
    why: ['A consistently high ROIC can indicate the company reinvests capital efficiently and may have a competitive advantage.', 'ROIC is around typical cost-of-capital levels.', 'ROIC is below a typical cost of capital — growth may not create value.'],
    basis: `EBIT × (1 − effective tax rate) ÷ (debt + equity − cash − short-term investments). Curve: ${curveText(c, '%')}`, sourceIds: fin, glossaryKey: 'roic' })
  c = [[5, 10, 15, 25, 40], [20, 45, 65, 85, 95]]
  const leveredRoe = isNum(L.debtToEquity) && L.debtToEquity > 1
  add({ id: 'prof.roe', category: 'profitability', label: 'Return on equity (ROE)', value: L.roe, display: fmtPct(L.roe), curve: c,
    why: ['High return on shareholders’ equity.', 'Moderate ROE.', 'Low ROE.'],
    cap: leveredRoe ? { max: 75, reason: 'Capped at 75 because debt exceeds equity: buybacks and leverage shrink book equity and flatter ROE.' } : undefined,
    basis: `Net income ÷ average equity. Curve: ${curveText(c, '%')}; capped at 75 when debt/equity > 1.`, sourceIds: fin, glossaryKey: 'roe' })
  c = [[2, 5, 10, 20], [25, 50, 75, 95]]
  add({ id: 'prof.roa', category: 'profitability', label: 'Return on assets (ROA)', value: L.roa, display: fmtPct(L.roa), curve: c, weight: 0.75,
    why: ['Assets generate strong profits.', 'Moderate return on assets.', 'Assets generate little profit.'],
    basis: `Net income ÷ average total assets. Curve: ${curveText(c, '%')}`, sourceIds: fin, glossaryKey: 'roa' })
  const marginDelta = isNum(L.operatingMargin) && isNum(fp.avg5.operatingMargin) ? L.operatingMargin - fp.avg5.operatingMargin : null
  c = [[-5, -2, 0, 2, 5], [20, 40, 55, 70, 85]]
  add({ id: 'prof.margin_trend', category: 'profitability', label: 'Operating margin vs 5-yr average', value: marginDelta, display: marginDelta === null ? NA : `${marginDelta >= 0 ? '+' : ''}${marginDelta.toFixed(1)} pp`, curve: c,
    why: ['Margins are expanding versus the 5-year average.', 'Margins are in line with the 5-year average.', 'Margins are contracting versus the 5-year average.'],
    basis: `Latest operating margin − 5-year average (percentage points). Curve: ${curveText(c, 'pp')}`, sourceIds: fin })

  // ───────────── GROWTH ─────────────
  const rc: Curve = [[-10, 0, 5, 10, 20], [10, 35, 55, 72, 90]]
  const gWhy: [string, string, string] = ['Growth is strong.', 'Growth is modest.', 'Growth is weak or negative.']
  add({ id: 'growth.rev_1y', category: 'growth', label: 'Revenue growth (1 yr)', value: fp.growth.revenue.y1, display: fmtPct(fp.growth.revenue.y1, 1, true), curve: rc, why: gWhy, basis: `Year-over-year revenue change. Curve: ${curveText(rc, '%')}`, sourceIds: fin, glossaryKey: 'revenueGrowth' })
  add({ id: 'growth.rev_3y', category: 'growth', label: 'Revenue CAGR (3 yr)', value: fp.growth.revenue.y3, display: fmtPct(fp.growth.revenue.y3, 1, true), curve: rc, why: gWhy, basis: `3-year compound annual growth rate. Curve: ${curveText(rc, '%')}`, sourceIds: fin, glossaryKey: 'cagr' })
  add({ id: 'growth.rev_5y', category: 'growth', label: 'Revenue CAGR (5 yr)', value: fp.growth.revenue.y5, display: fmtPct(fp.growth.revenue.y5, 1, true), curve: rc, weight: 1.5, why: gWhy, basis: `5-year CAGR. Curve: ${curveText(rc, '%')}`, sourceIds: fin, glossaryKey: 'cagr' })
  add({ id: 'growth.rev_10y', category: 'growth', label: 'Revenue CAGR (10 yr)', value: fp.growth.revenue.y10, display: fmtPct(fp.growth.revenue.y10, 1, true), curve: rc, why: gWhy, basis: `10-year CAGR. Curve: ${curveText(rc, '%')}`, sourceIds: fin, glossaryKey: 'cagr' })
  const ec: Curve = [[-5, 0, 5, 10, 15, 25], [10, 30, 50, 65, 80, 95]]
  add({ id: 'growth.eps_3y', category: 'growth', label: 'EPS CAGR (3 yr)', value: fp.growth.eps.y3, display: fmtPct(fp.growth.eps.y3, 1, true), curve: ec, why: gWhy, basis: `Diluted EPS 3-yr CAGR. Curve: ${curveText(ec, '%')}`, sourceIds: fin, glossaryKey: 'eps' })
  add({ id: 'growth.eps_5y', category: 'growth', label: 'EPS CAGR (5 yr)', value: fp.growth.eps.y5, display: fmtPct(fp.growth.eps.y5, 1, true), curve: ec, weight: 1.5, why: ['Earnings per share have compounded strongly (buybacks contribute).', 'EPS growth is modest.', 'EPS growth is weak or negative.'], basis: `Diluted EPS 5-yr CAGR. Curve: ${curveText(ec, '%')}`, sourceIds: fin, glossaryKey: 'eps' })
  add({ id: 'growth.fcf_5y', category: 'growth', label: 'FCF CAGR (5 yr)', value: fp.growth.fcf.y5, display: fmtPct(fp.growth.fcf.y5, 1, true), curve: ec, why: gWhy, basis: `Free cash flow 5-yr CAGR. Curve: ${curveText(ec, '%')}`, sourceIds: fin })
  add({ id: 'growth.opinc_5y', category: 'growth', label: 'Operating income CAGR (5 yr)', value: fp.growth.operatingIncome.y5, display: fmtPct(fp.growth.operatingIncome.y5, 1, true), curve: ec, why: gWhy, basis: `Operating income 5-yr CAGR. Curve: ${curveText(ec, '%')}`, sourceIds: fin })
  const est = ds.estimates
  const fwdRev = est && isNum(est.revenueNextFY) && isNum(a.revenue) && a.revenue > 0 ? (est.revenueNextFY / a.revenue - 1) * 100 : null
  const fwdEps = est && isNum(est.epsNextFY) && isNum(a.epsDiluted) && a.epsDiluted > 0 ? (est.epsNextFY / a.epsDiluted - 1) * 100 : null
  const estSrc = est ? [est.sourceId] : []
  add({ id: 'growth.fwd_revenue', category: 'growth', label: 'Expected revenue growth (next FY, consensus)', value: fwdRev, display: fmtPct(fwdRev, 1, true), curve: rc, weight: 0.75, why: ['Third-party analysts expect solid growth next year.', 'Analysts expect modest growth.', 'Analysts expect weak growth.'], basis: `Consensus next-FY revenue ÷ latest FY revenue − 1. Third-party estimate, not a platform forecast. Curve: ${curveText(rc, '%')}`, sourceIds: estSrc })
  add({ id: 'growth.fwd_eps', category: 'growth', label: 'Expected EPS growth (next FY, consensus)', value: fwdEps, display: fmtPct(fwdEps, 1, true), curve: ec, weight: 0.75, why: ['Analysts expect solid EPS growth next year.', 'Analysts expect modest EPS growth.', 'Analysts expect weak EPS growth.'], basis: `Consensus next-FY EPS ÷ latest FY EPS − 1. Third-party estimate. Curve: ${curveText(ec, '%')}`, sourceIds: estSrc })
  const trendScore = { accelerating: 80, stable: 60, slowing: 40, declining: 15, unknown: null }[fp.revenueTrend]
  add({ id: 'growth.trend', category: 'growth', label: 'Revenue growth trend', value: trendScore, display: fp.revenueTrend[0].toUpperCase() + fp.revenueTrend.slice(1), score: trendScore, weight: 0.75,
    why: ['Growth is accelerating relative to the 3-year trend.', 'Growth is broadly stable versus the 3-year trend.', 'Growth is slowing or declining versus the 3-year trend.'],
    basis: 'Compares 1-yr growth with 3-yr CAGR: >+2pp accelerating (80), within ±2pp stable (60), <−2pp slowing (40), negative on both declining (15).', sourceIds: fin })

  // ───────────── CASH FLOW ─────────────
  c = [[0, 5, 10, 20, 30], [10, 40, 60, 85, 100]]
  add({ id: 'cf.fcf_margin', category: 'cash_flow', label: 'Free cash flow margin', value: L.fcfMargin, display: fmtPct(L.fcfMargin), curve: c, weight: 2,
    why: ['A large share of revenue becomes free cash flow.', 'Moderate free cash flow generation.', 'Little revenue converts into free cash flow.'],
    basis: `(Operating cash flow − capex) ÷ revenue. Curve: ${curveText(c, '%')}`, sourceIds: fin, glossaryKey: 'fcfMargin' })
  c = [[50, 70, 90, 110], [20, 45, 75, 95]]
  add({ id: 'cf.fcf_conversion', category: 'cash_flow', label: 'FCF conversion (FCF ÷ net income)', value: L.fcfConversion, display: fmtPct(L.fcfConversion, 0), curve: c, weight: 1.5,
    why: ['Reported earnings are well supported by cash generation.', 'Most reported earnings convert to cash.', 'Reported earnings are not fully backed by cash — investigate working capital and accruals.'],
    basis: `Free cash flow ÷ net income. Curve: ${curveText(c, '%')}`, sourceIds: fin, glossaryKey: 'fcfConversion' })
  const prev = fp.previous
  const divergence = prev && isNum(L.netIncomeGrowth) && isNum(L.ocfGrowth) ? L.netIncomeGrowth > 0 && L.ocfGrowth < -5 : null
  add({ id: 'cf.ni_vs_ocf', category: 'cash_flow', label: 'Net income vs operating cash flow (latest year)', value: divergence === null ? null : divergence ? 1 : 0,
    display: divergence === null ? NA : `NI ${fmtPct(L.netIncomeGrowth, 1, true)} · OCF ${fmtPct(L.ocfGrowth, 1, true)}`,
    score: divergence === null ? null : divergence ? 30 : 75, weight: 1,
    why: ['Operating cash flow moved in line with (or ahead of) profits.', '', 'FLAG: profits rose while operating cash flow fell by more than 5%. This can be timing (working capital, tax payments) but should be checked in the cash flow statement.'],
    basis: 'Flag when net income growth > 0 and operating cash flow growth < −5% in the same year (score 30); otherwise 75.', sourceIds: fin })
  const posYears = fp.years.filter((y) => isNum(y.fcf) && y.fcf > 0).length
  const fcfYears = fp.years.filter((y) => isNum(y.fcf)).length
  add({ id: 'cf.fcf_consistency', category: 'cash_flow', label: 'Years of positive FCF', value: fcfYears ? posYears / fcfYears : null, display: fcfYears ? `${posYears} of ${fcfYears}` : NA, curve: [[0.5, 0.8, 1], [20, 60, 100]],
    why: ['Free cash flow was positive in every (or nearly every) year.', 'Free cash flow was negative in some years.', 'Free cash flow is frequently negative.'],
    basis: 'Share of years with positive FCF. Curve: 50%→20, 80%→60, 100%→100', sourceIds: fin })
  c = [[5, 10, 20, 35], [95, 80, 55, 25]]
  add({ id: 'cf.sbc', category: 'cash_flow', label: 'Stock-based compensation / FCF', value: L.sbcToFcf, display: fmtPct(L.sbcToFcf), curve: c,
    why: ['Stock-based pay is small relative to free cash flow.', 'Stock-based pay is a noticeable non-cash cost that FCF excludes.', 'Stock-based pay is large relative to FCF — FCF overstates owner earnings.'],
    basis: `SBC ÷ free cash flow. Curve: ${curveText(c, '%')}`, sourceIds: fin, glossaryKey: 'sbc' })
  c = [[3, 8, 15, 25], [85, 70, 45, 25]]
  add({ id: 'cf.capex', category: 'cash_flow', label: 'Capex intensity', value: L.capexToRevenue, display: fmtPct(L.capexToRevenue), curve: c, weight: 0.5,
    why: ['Low capital needs leave more cash for owners.', 'Moderate reinvestment needs.', 'Heavy capital needs absorb operating cash flow.'],
    basis: `Capital expenditure ÷ revenue. Curve: ${curveText(c, '%')}`, sourceIds: fin })

  // ───────────── VALUATION ─────────────
  const pc: Curve = [[-40, -20, 0, 20, 50, 100], [95, 80, 60, 45, 25, 10]]
  const scoredMultiples: MultipleComparison['key'][] = ['pe', 'forwardPe', 'evToEbitda', 'pfcf', 'ps', 'evToEbit']
  for (const m of multiples.filter((mm) => scoredMultiples.includes(mm.key))) {
    const refs = [m.avg5 !== null && '5-yr avg', m.avg10 !== null && '10-yr avg', m.industry !== null && 'industry median', m.peerMedian !== null && 'peer median'].filter(Boolean).join(', ')
    add({ id: `val.${m.key}`, category: 'valuation', label: `${m.label} vs history & peers`, value: m.premiumPct,
      display: isNum(m.current) ? `${fmtX(m.current)} (${m.premiumPct === null ? 'no reference' : `${m.premiumPct >= 0 ? '+' : ''}${m.premiumPct.toFixed(0)}% vs ref.`})` : NA,
      curve: pc, weight: m.key === 'pe' || m.key === 'pfcf' || m.key === 'evToEbitda' ? 1.25 : 0.75,
      why: ['Trades at a discount to its own history and/or peers on this measure.', 'Roughly in line with, or modestly above, its references.', 'Trades at a significant premium to its references on this measure.'],
      basis: `Premium of current multiple vs the average of available references (${refs || 'none'}). Curve (premium %→score): ${curveText(pc, '%')}`, sourceIds: [...fin, ds.quote.sourceId, ...(ds.industry ? [ds.industry.sourceId] : [])], glossaryKey: m.key })
  }
  c = [[0.8, 1.2, 1.8, 2.5, 3.5], [90, 72, 52, 32, 15]]
  add({ id: 'val.peg', category: 'valuation', label: 'PEG ratio', value: val.peg, display: fmtX(val.peg, 2), curve: c,
    why: ['Price is modest relative to expected growth.', 'Price is broadly in line with expected growth.', 'Price is high relative to expected growth.'],
    basis: `P/E ÷ ${val.pegGrowthBasis}. Curve: ${curveText(c, '×')}`, sourceIds: [...fin, ...estSrc], glossaryKey: 'peg' })
  c = [[1, 2, 3, 5, 8], [15, 30, 45, 70, 95]]
  add({ id: 'val.fcf_yield', category: 'valuation', label: 'FCF yield', value: val.fcfYield, display: fmtPct(val.fcfYield, 2), curve: c, weight: 1.5,
    why: ['Free cash flow is high relative to the market value.', 'Free cash flow yield is moderate.', 'Low FCF yield — the price assumes substantial future growth.'],
    basis: `FCF ÷ market cap. Curve: ${curveText(c, '%')}`, sourceIds: [...fin, ds.quote.sourceId], glossaryKey: 'fcfYield' })
  c = [[2, 4, 6, 9, 12], [15, 35, 55, 75, 95]]
  add({ id: 'val.earnings_yield', category: 'valuation', label: 'Earnings yield (EBIT / EV)', value: val.earningsYield, display: fmtPct(val.earningsYield, 2), curve: c,
    why: ['Operating earnings are high relative to enterprise value.', 'Moderate earnings yield.', 'Low earnings yield relative to enterprise value.'],
    basis: `EBIT ÷ enterprise value. Curve: ${curveText(c, '%')}`, sourceIds: [...fin, ds.quote.sourceId], glossaryKey: 'earningsYield' })
  c = [[-50, -20, 0, 15, 30], [10, 30, 50, 70, 90]]
  add({ id: 'val.dcf', category: 'valuation', label: 'DCF base-case margin of safety', value: ctx.dcfMarginOfSafety, display: fmtPct(ctx.dcfMarginOfSafety, 0, true), curve: c, weight: 1.5,
    why: ['The base-case DCF value is above the current price.', 'Price is close to the base-case DCF value.', 'Price is above the base-case DCF value — the market assumes more than the base case.'],
    basis: `(Base-case DCF value − price) ÷ DCF value, using the default assumptions shown in the DCF section. Curve: ${curveText(c, '%')}`, sourceIds: [...fin, ds.quote.sourceId], glossaryKey: 'dcf' })

  // ───────────── BUSINESS QUALITY / MOAT ─────────────
  const q = ds.qualitative
  add({ id: 'moat.qualitative', category: 'business_quality', label: 'Moat sources (editorial assessment)', value: ctx.moatQualitative, display: isNum(ctx.moatQualitative) ? `${Math.round(ctx.moatQualitative)}/100` : NA, score: ctx.moatQualitative, weight: 3, qualitative: true,
    why: ['Multiple strong, evidenced moat sources (see Moat section).', 'Some moat sources, of moderate strength.', 'Few evidenced moat sources.'],
    basis: 'Weighted rubric of 10 moat sources, each rated 0–3 with evidence; brand, switching costs, network effects, ecosystem and scale weighted highest.', sourceIds: q ? [q.sourceId] : [], glossaryKey: 'moat' })
  const roicShare = fp.years.filter((y) => isNum(y.roic)).length ? fp.roicAbove15Years / fp.years.filter((y) => isNum(y.roic)).length : null
  c = [[0.2, 0.5, 0.8, 1], [20, 50, 80, 100]]
  add({ id: 'moat.roic_persistence', category: 'business_quality', label: 'ROIC ≥ 15% persistence', value: roicShare, display: roicShare === null ? NA : `${fp.roicAbove15Years} of ${fp.years.filter((y) => isNum(y.roic)).length} years`, curve: c, weight: 2,
    why: ['Returns have stayed high for many years — consistent with a durable advantage.', 'Returns have been high in some years only.', 'High returns have not persisted.'],
    basis: `Share of years with ROIC ≥ 15%. Curve: ${curveText(c)}`, sourceIds: fin })
  c = [[1, 3, 6, 10], [95, 75, 45, 20]]
  add({ id: 'moat.gm_stability', category: 'business_quality', label: 'Gross margin stability (std. dev.)', value: fp.grossMarginStdev, display: isNum(fp.grossMarginStdev) ? `${fp.grossMarginStdev.toFixed(1)} pp` : NA, curve: c,
    why: ['Gross margins have been stable — a sign of pricing power.', 'Gross margins vary moderately.', 'Gross margins are volatile.'],
    basis: `Standard deviation of annual gross margin. Curve: ${curveText(c, 'pp')}`, sourceIds: fin })
  const gmDelta = isNum(L.grossMargin) && isNum(fp.avg10.grossMargin) ? L.grossMargin - fp.avg10.grossMargin : null
  c = [[-5, 0, 3, 6], [20, 55, 75, 90]]
  add({ id: 'moat.pricing_power', category: 'business_quality', label: 'Pricing power (gross margin vs 10-yr avg)', value: gmDelta, display: gmDelta === null ? NA : `${gmDelta >= 0 ? '+' : ''}${gmDelta.toFixed(1)} pp`, curve: c,
    why: ['Gross margin is above its long-run average — suggests pricing power or better mix.', 'Gross margin is near its long-run average.', 'Gross margin is below its long-run average.'],
    basis: `Latest gross margin − 10-yr average. Curve: ${curveText(c, 'pp')}`, sourceIds: fin })

  // ───────────── MANAGEMENT & CAPITAL ALLOCATION ─────────────
  c = [[-4, -2, 0, 2, 5], [95, 85, 60, 35, 10]]
  add({ id: 'mgmt.share_count', category: 'management', label: 'Share count change (5-yr, per year)', value: ctx.dilution.rate5, display: fmtPct(ctx.dilution.rate5, 1, true), curve: c, weight: 1.5,
    why: ['Net buybacks are steadily increasing each shareholder’s ownership.', 'Share count is broadly stable.', 'Shareholders are being diluted.'],
    basis: `Diluted shares 5-yr CAGR. Curve: ${curveText(c, '%')}`, sourceIds: fin, glossaryKey: 'dilution' })
  const retFcf5 = mean(fp.years.slice(-5).map((y) => y.shareholderYieldOfFcf))
  c = [[0, 30, 60, 90, 110, 140], [40, 60, 80, 90, 75, 45]]
  add({ id: 'mgmt.shareholder_returns', category: 'management', label: 'Dividends + buybacks / FCF (5-yr avg)', value: retFcf5, display: fmtPct(retFcf5, 0), curve: c,
    why: ['Most free cash flow is returned to shareholders.', 'Returns to shareholders are moderate — or exceed FCF, implying use of cash reserves or debt.', 'Returns exceed FCF by a wide margin, or little is returned.'],
    basis: `Average of (dividends + buybacks) ÷ FCF over 5 years. Curve peaks at ~90%: ${curveText(c, '%')}`, sourceIds: fin })
  c = [[1, 3, 6, 10], [95, 75, 45, 20]]
  add({ id: 'mgmt.sbc', category: 'management', label: 'Stock-based compensation / revenue', value: L.sbcToRevenue, display: fmtPct(L.sbcToRevenue), curve: c,
    why: ['Equity compensation is modest relative to the business size.', 'Equity compensation is noticeable.', 'Equity compensation is heavy.'],
    basis: `SBC ÷ revenue. Curve: ${curveText(c, '%')}`, sourceIds: fin, glossaryKey: 'sbc' })
  const acqShare = (() => {
    const ys = ds.annual.slice(-5)
    const acq = ys.reduce((s, y) => s + (y.acquisitions ?? 0), 0)
    const f = ys.reduce((s, y) => s + (y.freeCashFlow ?? 0), 0)
    return f > 0 && ys.some((y) => isNum(y.acquisitions)) ? (acq / f) * 100 : null
  })()
  c = [[5, 20, 50, 100], [90, 70, 45, 20]]
  add({ id: 'mgmt.acquisitions', category: 'management', label: 'Acquisition spend / FCF (5-yr)', value: acqShare, display: fmtPct(acqShare), curve: c, weight: 0.75,
    why: ['Growth is mainly organic; little capital spent on acquisitions.', 'Acquisitions are a meaningful use of cash.', 'Heavy reliance on acquisitions, which carry integration risk.'],
    basis: `Cash acquisitions ÷ FCF over 5 years. Curve: ${curveText(c, '%')}`, sourceIds: fin })
  const roicDelta = isNum(L.roic) && isNum(fp.avg5.roic) ? L.roic - fp.avg5.roic : null
  c = [[-10, -3, 0, 3, 10], [25, 45, 60, 75, 90]]
  add({ id: 'mgmt.roic_trend', category: 'management', label: 'ROIC vs 5-yr average', value: roicDelta, display: roicDelta === null ? NA : `${roicDelta >= 0 ? '+' : ''}${roicDelta.toFixed(1)} pp`, curve: c,
    why: ['Capital is being deployed at improving returns.', 'Returns on capital are steady.', 'Returns on capital are declining.'],
    basis: `Latest ROIC − 5-yr average. Curve: ${curveText(c, 'pp')}`, sourceIds: fin })
  const tenure = ds.profile.ceoSince ? new Date(ds.generatedAt).getUTCFullYear() - ds.profile.ceoSince : null
  c = [[1, 3, 7, 12], [45, 55, 70, 75]]
  add({ id: 'mgmt.ceo_tenure', category: 'management', label: 'CEO tenure', value: tenure, display: tenure === null ? NA : `${tenure} years`, curve: c, weight: 0.5,
    why: ['Long tenure provides a measurable track record to evaluate.', 'Moderate tenure.', 'Short tenure — limited track record.'],
    basis: `Years since appointment (from profile). Measurable fact only — no judgement of individuals. Curve: ${curveText(c, 'y')}`, sourceIds: [ds.profile.sourceId] })
  add({ id: 'mgmt.insider_ownership', category: 'management', label: 'Insider ownership', value: ds.ownership?.insiderPct ?? null, display: fmtPct(ds.ownership?.insiderPct), curve: [[0.1, 1, 5, 15], [45, 55, 70, 80]], weight: 0.5,
    why: ['Management owns a meaningful stake.', 'Insider ownership is modest (common for mega-caps).', 'Very low insider ownership.'],
    basis: 'Insider-held shares ÷ shares outstanding (from ownership provider).', sourceIds: ds.ownership ? [ds.ownership.sourceId] : [] })

  // ───────────── RISK (higher score = lower risk) ─────────────
  c = [[-1, 0.5, 1.5, 3, 4.5], [95, 85, 65, 35, 10]]
  add({ id: 'risk.debt', category: 'risk', label: 'Debt risk', value: L.netDebtToEbitda, display: fmtX(L.netDebtToEbitda, 2) + ' net debt/EBITDA', curve: c,
    why: ['Low debt risk.', 'Moderate debt risk.', 'High debt risk.'], basis: `Net debt ÷ EBITDA. Curve: ${curveText(c, '×')}`, sourceIds: fin })
  const valPrem = mean(multiples.filter((m) => ['pe', 'evToEbitda', 'pfcf'].includes(m.key)).map((m) => m.premiumPct))
  c = [[-20, 0, 20, 50, 100], [90, 75, 55, 30, 10]]
  add({ id: 'risk.valuation', category: 'risk', label: 'Valuation risk', value: valPrem, display: valPrem === null ? NA : `${valPrem >= 0 ? '+' : ''}${valPrem.toFixed(0)}% avg premium`, curve: c,
    why: ['Low valuation risk: multiples at or below references.', 'Moderate valuation risk.', 'Elevated valuation risk: a de-rating to historical multiples would lower the price even if the business performs.'],
    basis: `Average premium of P/E, EV/EBITDA and P/FCF vs references. Curve: ${curveText(c, '%')}`, sourceIds: fin })
  c = [[-2, 0, 1, 3, 6], [90, 80, 60, 30, 10]]
  add({ id: 'risk.dilution', category: 'risk', label: 'Dilution risk', value: ctx.dilution.rate5, display: fmtPct(ctx.dilution.rate5, 1, true) + ' shares/yr', curve: c,
    why: ['No dilution — the share count is falling.', 'Mild dilution.', 'Significant dilution.'], basis: `5-yr share count CAGR. Curve: ${curveText(c, '%')}`, sourceIds: fin })
  const revVol = fp.years.filter((y) => isNum(y.revenueGrowth)).length
  const downShare = revVol ? fp.revenueDownYears / revVol : null
  c = [[0, 0.15, 0.3, 0.5], [90, 70, 45, 20]]
  add({ id: 'risk.cyclicality', category: 'risk', label: 'Cyclicality (revenue down-years)', value: downShare, display: downShare === null ? NA : `${fp.revenueDownYears} of ${revVol} years`, curve: c,
    why: ['Revenue rarely declines.', 'Revenue declines occasionally — some cyclicality.', 'Revenue declines often — highly cyclical.'], basis: `Share of years with falling revenue. Curve: ${curveText(c)}`, sourceIds: fin })
  const seg = ds.segments
  const segTotal = seg ? seg.byProduct.reduce((s, x) => s + x.value, 0) : 0
  const topSeg = seg && segTotal > 0 ? (Math.max(...seg.byProduct.map((x) => x.value)) / segTotal) * 100 : null
  c = [[30, 45, 60, 80], [85, 65, 45, 25]]
  add({ id: 'risk.concentration', category: 'risk', label: 'Revenue concentration (largest segment)', value: topSeg, display: fmtPct(topSeg, 0), curve: c,
    why: ['Revenue is diversified across segments.', 'One segment is a large share of revenue — monitor.', 'Heavy dependence on a single segment.'], basis: `Largest product segment ÷ total. Curve: ${curveText(c, '%')}`, sourceIds: seg ? [seg.sourceId] : [] })
  if (q) {
    for (const r of q.risks.filter((rr) => !QUANT_RISKS.includes(rr.key))) {
      const score = { 1: 90, 2: 65, 3: 40, 4: 15 }[r.level]
      add({ id: `risk.q.${r.key}`, category: 'risk', label: RISK_LABELS[r.key], value: r.level, display: ['', 'Low', 'Moderate', 'Elevated', 'High'][r.level], score, weight: 0.6, qualitative: true,
        why: [r.evidence, r.evidence, r.evidence], basis: 'Editorial risk rating 1–4 with evidence (Low 90 · Moderate 65 · Elevated 40 · High 15).', sourceIds: [q.sourceId] })
    }
  } else {
    add({ id: 'risk.q.none', category: 'risk', label: 'Qualitative risk review', value: null, why: ['', '', ''], basis: 'Requires reviewed editorial inputs (regulation, geopolitics, suppliers…).', sourceIds: [], qualitative: true })
  }
  const sI = ds.shortInterest
  add({ id: 'risk.short_interest', category: 'risk', label: 'Short interest (% of float)', value: sI?.pctFloat ?? null, display: fmtPct(sI?.pctFloat), curve: [[1, 3, 8, 15], [85, 70, 45, 20]], weight: 0.5,
    why: ['Little bearish positioning.', 'Moderate short interest.', 'High short interest — some investors are betting on a decline.'], basis: 'Shares sold short ÷ float. Context signal, low weight.', sourceIds: sI ? [sI.sourceId] : [] })

  // ───────────── TECHNICAL (small weight by design) ─────────────
  const priceSrc = [ds.pricesSynthetic ? 'demo-prices' : ds.quote.sourceId]
  if (tech && isNum(tech.price)) {
    const vs200 = isNum(tech.sma200) ? (tech.price / tech.sma200 - 1) * 100 : null
    c = [[-15, -5, 0, 5, 15, 30], [20, 40, 55, 70, 75, 60]]
    add({ id: 'tech.vs_sma200', category: 'technical', label: 'Price vs 200-day average', value: vs200, display: fmtPct(vs200, 1, true), curve: c,
      why: ['Price is in a long-term uptrend.', 'Price is near its long-term average.', 'Price is below its long-term trend.'], basis: `(Price ÷ SMA200 − 1). Curve (overextension scores lower): ${curveText(c, '%')}`, sourceIds: priceSrc })
    const cross = isNum(tech.sma50) && isNum(tech.sma200) ? (tech.sma50 > tech.sma200 ? 1 : 0) : null
    add({ id: 'tech.sma_cross', category: 'technical', label: '50-day vs 200-day average', value: cross, display: cross === null ? NA : cross ? '50d above 200d' : '50d below 200d', score: cross === null ? null : cross ? 70 : 35,
      why: ['Medium-term trend is above the long-term trend.', '', 'Medium-term trend is below the long-term trend.'], basis: '50-day SMA above 200-day SMA → 70, else 35.', sourceIds: priceSrc })
    c = [[20, 30, 45, 60, 70, 80], [45, 55, 60, 65, 50, 35]]
    add({ id: 'tech.rsi', category: 'technical', label: 'RSI (14)', value: tech.rsi14, display: isNum(tech.rsi14) ? tech.rsi14.toFixed(0) : NA, curve: c,
      why: ['Momentum is healthy without being overbought.', 'Momentum is neutral or stretched.', 'Momentum is overbought or very weak.'], basis: `Wilder RSI(14). Curve: ${curveText(c)}`, sourceIds: priceSrc, glossaryKey: 'rsi' })
    add({ id: 'tech.macd', category: 'technical', label: 'MACD histogram', value: tech.macdHistogram, display: isNum(tech.macdHistogram) ? tech.macdHistogram.toFixed(2) : NA, score: isNum(tech.macdHistogram) ? (tech.macdHistogram > 0 ? 65 : 40) : null,
      why: ['Short-term momentum is positive.', '', 'Short-term momentum is negative.'], basis: 'MACD(12,26,9) histogram > 0 → 65, else 40.', sourceIds: priceSrc })
    c = [[-30, -10, 0, 10, 30], [20, 40, 50, 65, 75]]
    add({ id: 'tech.momentum_12m', category: 'technical', label: '12-month price momentum', value: tech.return12m, display: fmtPct(tech.return12m, 1, true), curve: c,
      why: ['Positive 12-month momentum.', 'Flat 12-month momentum.', 'Negative 12-month momentum.'], basis: `12-month price return. Curve: ${curveText(c, '%')}`, sourceIds: priceSrc })
  }

  // ───────────── SENTIMENT ─────────────
  add({ id: 'sent.news', category: 'sentiment', label: 'News sentiment', value: null, why: ['', '', ''], basis: 'Requires a news provider; classified by an NLP model and shown separately from fundamentals.', sourceIds: [] })
  add({ id: 'sent.revisions', category: 'sentiment', label: 'Analyst estimate revisions (90 days)', value: null, why: ['', '', ''], basis: 'Requires estimate history from a provider.', sourceIds: [] })

  // ───────────── DIVIDEND (weighted only in dividend mode by default) ─────────────
  const paysDividend = isNum(a.dividendsPaid) && a.dividendsPaid > 0
  if (paysDividend) {
    c = [[0, 30, 50, 70, 90], [70, 95, 85, 55, 20]]
    add({ id: 'div.payout', category: 'dividend', label: 'Payout ratio (earnings)', value: L.payoutRatio, display: fmtPct(L.payoutRatio), curve: c,
      why: ['Dividend is well covered by earnings.', 'Dividend uses a large share of earnings.', 'Dividend is poorly covered by earnings.'], basis: `Dividends ÷ net income. Curve: ${curveText(c, '%')}`, sourceIds: fin, glossaryKey: 'payoutRatio' })
    add({ id: 'div.fcf_payout', category: 'dividend', label: 'Payout ratio (FCF)', value: L.fcfPayoutRatio, display: fmtPct(L.fcfPayoutRatio), curve: c, weight: 1.5,
      why: ['Dividend is well covered by free cash flow.', 'Dividend uses a large share of FCF.', 'Dividend exceeds or nearly exceeds FCF.'], basis: `Dividends ÷ FCF. Curve: ${curveText(c, '%')}`, sourceIds: fin })
    c = [[0, 3, 6, 10], [30, 55, 75, 90]]
    add({ id: 'div.growth', category: 'dividend', label: 'Dividend per share CAGR (5 yr)', value: fp.growth.dividend.y5, display: fmtPct(fp.growth.dividend.y5, 1, true), curve: c,
      why: ['Dividend has grown steadily.', 'Dividend growth is modest.', 'Dividend growth is weak.'], basis: `DPS 5-yr CAGR. Curve: ${curveText(c, '%')}`, sourceIds: fin })
    let streak = 0
    for (let i = fp.years.length - 1; i >= 0; i--) {
      const g = fp.years[i].dividendGrowth
      if (isNum(g) && g > 0) streak++
      else break
    }
    add({ id: 'div.streak', category: 'dividend', label: 'Consecutive years of dividend growth (in dataset)', value: streak, display: `${streak} years`, curve: [[1, 5, 10], [30, 65, 90]],
      why: ['Long record of annual dividend increases.', 'Some record of increases.', 'Little record of increases.'], basis: 'Consecutive annual DPS increases within the available history (may understate longer records).', sourceIds: fin })
    c = [[0, 1, 2, 3.5, 6], [20, 35, 55, 80, 70]]
    add({ id: 'div.yield', category: 'dividend', label: 'Dividend yield', value: val.dividendYield, display: fmtPct(val.dividendYield, 2), curve: c,
      why: ['Meaningful income yield.', 'Modest income yield.', 'Low income yield.'], basis: `DPS ÷ price. Curve: ${curveText(c, '%')}`, sourceIds: [...fin, ds.quote.sourceId], glossaryKey: 'dividendYield' })
  } else {
    add({ id: 'div.none', category: 'dividend', label: 'Dividend', value: null, display: 'No dividend', why: ['', '', ''], basis: 'Company does not pay a dividend in the latest year.', sourceIds: fin })
  }

  return out
}

/** Moat rubric → 0–100. */
export function moatRubricScore(ds: CompanyDataset): Num {
  const m = ds.qualitative?.moat
  if (!m?.length) return null
  const W: Record<string, number> = { brand: 1.5, switching_costs: 1.5, network_effects: 1.5, ecosystem: 1.25, scale: 1.25, cost_advantage: 1, intellectual_property: 1, distribution: 0.75, data: 0.75, regulatory: 0.75 }
  // Best three sources dominate: a moat needs only a few strong sources, not all ten.
  const weighted = m.map((x) => ({ w: W[x.source] ?? 1, s: x.strength / 3 })).sort((p, q) => q.s * q.w - p.s * p.w)
  const top = weighted.slice(0, 4)
  const rest = weighted.slice(4)
  const topScore = top.reduce((s, x) => s + x.s * x.w, 0) / top.reduce((s, x) => s + x.w, 0)
  const restScore = rest.length ? rest.reduce((s, x) => s + x.s * x.w, 0) / rest.reduce((s, x) => s + x.w, 0) : topScore
  return Math.round((topScore * 0.8 + restScore * 0.2) * 100)
}

