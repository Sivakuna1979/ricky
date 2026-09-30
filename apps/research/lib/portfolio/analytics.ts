/**
 * Portfolio analytics — descriptive only. Highlights data and concentration;
 * never tells the user what to buy or sell.
 */
export interface PricedHolding {
  id: string
  ticker: string
  name: string
  sector: string
  country: string
  quantity: number
  purchasePrice: number
  price: number | null // null = no current price available
  dividendYield: number | null // %
  score: number | null
  scoreKind: 'full' | 'snapshot' | null
}

export interface PortfolioAnalytics {
  cost: number
  value: number
  pnl: number
  pnlPct: number | null
  positions: (PricedHolding & { value: number; cost: number; pnl: number; pnlPct: number | null; weight: number; priced: boolean })[]
  bySector: { name: string; weight: number }[]
  byCountry: { name: string; weight: number }[]
  dividendIncome: number
  qualityScore: number | null
  qualityCoverage: number // share of value with a score
  warnings: { level: 'info' | 'warn'; text: string }[]
}

const group = (rows: { key: string; value: number }[], total: number) => {
  const m = new Map<string, number>()
  for (const r of rows) m.set(r.key, (m.get(r.key) ?? 0) + r.value)
  return [...m.entries()].map(([name, v]) => ({ name, weight: total > 0 ? (v / total) * 100 : 0 })).sort((a, b) => b.weight - a.weight)
}

export function analysePortfolio(holdings: PricedHolding[]): PortfolioAnalytics {
  const positions = holdings.map((h) => {
    const cost = h.quantity * h.purchasePrice
    const priced = h.price !== null
    // Without a live price the position is carried at cost (flagged) rather than guessed.
    const value = h.quantity * (h.price ?? h.purchasePrice)
    return { ...h, cost, value, pnl: value - cost, pnlPct: cost > 0 && priced ? ((value - cost) / cost) * 100 : null, weight: 0, priced }
  })
  const value = positions.reduce((s, p) => s + p.value, 0)
  const cost = positions.reduce((s, p) => s + p.cost, 0)
  positions.forEach((p) => (p.weight = value > 0 ? (p.value / value) * 100 : 0))
  positions.sort((a, b) => b.value - a.value)

  const scored = positions.filter((p) => p.score !== null)
  const scoredValue = scored.reduce((s, p) => s + p.value, 0)
  const qualityScore = scoredValue > 0 ? Math.round(scored.reduce((s, p) => s + (p.score as number) * p.value, 0) / scoredValue) : null
  const bySector = group(positions.map((p) => ({ key: p.sector || 'Unknown', value: p.value })), value)
  const byCountry = group(positions.map((p) => ({ key: p.country || 'Unknown', value: p.value })), value)

  const warnings: PortfolioAnalytics['warnings'] = []
  for (const p of positions) if (p.weight > 25) warnings.push({ level: 'warn', text: `${p.ticker} is ${p.weight.toFixed(0)}% of the portfolio — a single-company concentration above 25%.` })
  if (bySector[0] && bySector[0].weight > 40 && positions.length > 1) warnings.push({ level: 'warn', text: `${bySector[0].name} is ${bySector[0].weight.toFixed(0)}% of the portfolio — sector concentration above 40%.` })
  if (byCountry[0] && byCountry[0].weight > 80 && positions.length > 2) warnings.push({ level: 'info', text: `${byCountry[0].weight.toFixed(0)}% of the value is in ${byCountry[0].name}-listed companies — consider whether that geographic exposure is intended.` })
  if (positions.length > 0 && positions.length < 5) warnings.push({ level: 'info', text: `${positions.length} holding${positions.length > 1 ? 's' : ''}: outcomes will depend heavily on a few companies.` })
  const unpriced = positions.filter((p) => !p.priced)
  if (unpriced.length) warnings.push({ level: 'info', text: `No current price for ${unpriced.map((p) => p.ticker).join(', ')} — valued at purchase cost.` })

  return {
    cost,
    value,
    pnl: value - cost,
    pnlPct: cost > 0 ? ((value - cost) / cost) * 100 : null,
    positions,
    bySector,
    byCountry,
    dividendIncome: positions.reduce((s, p) => s + (p.dividendYield ? (p.value * p.dividendYield) / 100 : 0), 0),
    qualityScore,
    qualityCoverage: value > 0 ? (scoredValue / value) * 100 : 0,
    warnings,
  }
}
