import type { Indicator } from './types'

export type CheckStatus = 'pass' | 'neutral' | 'fail' | 'unavailable'

export interface ChecklistItem {
  group: string
  question: string
  status: CheckStatus
  evidence: string
  indicatorId: string
}

/** Each checklist item is a plain-language question answered by one scored indicator. */
const SPEC: [string, string, string][] = [
  ['Financial Health', 'Is revenue growing?', 'growth.rev_1y'],
  ['Financial Health', 'Is free cash flow positive, consistently?', 'cf.fcf_consistency'],
  ['Financial Health', 'Is debt manageable relative to earnings?', 'fs.net_debt_ebitda'],
  ['Financial Health', 'Could free cash flow repay debt quickly?', 'fs.fcf_to_debt'],
  ['Financial Health', 'Are short-term obligations covered (current ratio)?', 'fs.current_ratio'],
  ['Financial Health', 'Is interest comfortably covered?', 'fs.interest_coverage'],
  ['Financial Health', 'Is the balance sheet free of heavy goodwill?', 'fs.goodwill'],
  ['Business Quality', 'Is there an evidenced economic moat?', 'moat.qualitative'],
  ['Business Quality', 'Has ROIC stayed high for years?', 'moat.roic_persistence'],
  ['Business Quality', 'Are gross margins stable?', 'moat.gm_stability'],
  ['Business Quality', 'Is there evidence of pricing power?', 'moat.pricing_power'],
  ['Profitability', 'Is ROIC strong?', 'prof.roic'],
  ['Profitability', 'Are operating margins strong?', 'prof.operating_margin'],
  ['Profitability', 'Are margins stable or expanding?', 'prof.margin_trend'],
  ['Profitability', 'Is ROE strong (without excessive leverage)?', 'prof.roe'],
  ['Growth', 'Has revenue compounded over 5 years?', 'growth.rev_5y'],
  ['Growth', 'Has EPS compounded over 5 years?', 'growth.eps_5y'],
  ['Growth', 'Is growth accelerating or stable?', 'growth.trend'],
  ['Growth', 'Do analysts expect continued growth?', 'growth.fwd_revenue'],
  ['Cash Flow', 'Is the FCF margin strong?', 'cf.fcf_margin'],
  ['Cash Flow', 'Are earnings backed by cash?', 'cf.fcf_conversion'],
  ['Cash Flow', 'Did cash flow keep pace with profits?', 'cf.ni_vs_ocf'],
  ['Cash Flow', 'Is stock-based pay modest vs FCF?', 'cf.sbc'],
  ['Valuation', 'Is P/E at or below its references?', 'val.pe'],
  ['Valuation', 'Is EV/EBITDA at or below its references?', 'val.evToEbitda'],
  ['Valuation', 'Is price/FCF at or below its references?', 'val.pfcf'],
  ['Valuation', 'Is the PEG ratio reasonable?', 'val.peg'],
  ['Valuation', 'Is the FCF yield attractive?', 'val.fcf_yield'],
  ['Valuation', 'Is price below the base-case DCF value?', 'val.dcf'],
  ['Management', 'Is the share count falling (net buybacks)?', 'mgmt.share_count'],
  ['Management', 'Is cash returned sensibly?', 'mgmt.shareholder_returns'],
  ['Management', 'Is growth organic rather than acquisition-driven?', 'mgmt.acquisitions'],
  ['Management', 'Are returns on capital improving?', 'mgmt.roic_trend'],
  ['Risk', 'Is valuation risk contained?', 'risk.valuation'],
  ['Risk', 'Is revenue diversified?', 'risk.concentration'],
  ['Risk', 'Is regulatory risk contained?', 'risk.q.regulation'],
  ['Risk', 'Is geopolitical exposure contained?', 'risk.q.geopolitical'],
  ['Risk', 'Is the supply chain diversified?', 'risk.q.supplier_concentration'],
  ['Risk', 'Is the business resilient to downturns?', 'risk.cyclicality'],
  ['Dividend', 'Is the dividend covered by free cash flow?', 'div.fcf_payout'],
  ['Dividend', 'Has the dividend grown?', 'div.growth'],
]

export function buildChecklist(indicators: Indicator[]): { items: ChecklistItem[]; counts: Record<CheckStatus, number> } {
  const byId = new Map(indicators.map((i) => [i.id, i]))
  const items: ChecklistItem[] = []
  for (const [group, question, id] of SPEC) {
    const ind = byId.get(id)
    if (!ind) continue
    const status: CheckStatus =
      ind.rating === 'unavailable' ? 'unavailable' : ind.rating === 'strong_positive' || ind.rating === 'positive' ? 'pass' : ind.rating === 'neutral' ? 'neutral' : 'fail'
    items.push({ group, question, status, evidence: `${ind.label}: ${ind.display}`, indicatorId: id })
  }
  const counts = { pass: 0, neutral: 0, fail: 0, unavailable: 0 }
  for (const i of items) counts[i.status]++
  return { items, counts }
}
