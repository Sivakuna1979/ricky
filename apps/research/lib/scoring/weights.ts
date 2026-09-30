import type { CategoryKey, InvestorMode, Weights } from './types'

const w = (fs: number, bq: number, prof: number, gr: number, cf: number, val: number, mg: number, risk: number, tech: number, sent: number, div: number): Weights => ({
  financial_strength: fs,
  business_quality: bq,
  profitability: prof,
  growth: gr,
  cash_flow: cf,
  valuation: val,
  management: mg,
  risk,
  technical: tech,
  sentiment: sent,
  dividend: div,
})

/** Category weights in % (each preset sums to 100). */
export const MODE_WEIGHTS: Record<Exclude<InvestorMode, 'custom'>, Weights> = {
  balanced: w(15, 15, 10, 10, 10, 15, 10, 10, 2.5, 2.5, 0),
  value: w(15, 10, 7.5, 5, 12.5, 30, 7.5, 10, 1.25, 1.25, 0),
  quality: w(17.5, 22.5, 17.5, 7.5, 12.5, 7.5, 7.5, 5, 1.25, 1.25, 0),
  growth: w(7.5, 12.5, 10, 35, 10, 7.5, 5, 7.5, 3, 2, 0),
  dividend: w(15, 7.5, 7.5, 5, 15, 10, 5, 7.5, 1, 1, 25.5),
  garp: w(10, 12.5, 10, 20, 10, 22.5, 7.5, 5, 1.25, 1.25, 0),
  buffett: w(12.5, 25, 12.5, 5, 17.5, 15, 10, 2.5, 0, 0, 0),
  graham: w(30, 5, 7.5, 5, 10, 32.5, 2.5, 7.5, 0, 0, 0),
  lynch: w(12.5, 15, 7.5, 25, 7.5, 22.5, 5, 5, 0, 0, 0),
}

export const MODE_INFO: Record<InvestorMode, { label: string; description: string }> = {
  balanced: { label: 'Balanced (default)', description: 'The platform default: fundamentals dominate; technicals and sentiment together are only 5%.' },
  value: { label: 'Value investor', description: 'Heavier weight on valuation and cash generation.' },
  quality: { label: 'Quality investor', description: 'Heavier weight on moat, profitability (ROIC) and financial strength.' },
  growth: { label: 'Growth investor', description: 'Heavier weight on revenue and EPS growth.' },
  dividend: { label: 'Dividend investor', description: 'Adds dividend safety & growth, plus cash flow.' },
  garp: { label: 'GARP', description: 'Growth at a reasonable price: growth and valuation balanced.' },
  buffett: { label: 'Buffett-style', description: 'Quality + moat + cash generation + sensible valuation. Framework inspired by published principles — not an endorsement.' },
  graham: { label: 'Graham-style', description: 'Balance sheet + valuation + margin of safety.' },
  lynch: { label: 'Lynch-style', description: 'Growth + PEG-aware valuation + business quality.' },
  custom: { label: 'Custom strategy', description: 'Your own weights.' },
}

export function weightsFor(mode: InvestorMode, custom?: Weights): Weights {
  if (mode === 'custom' && custom) return custom
  return MODE_WEIGHTS[mode === 'custom' ? 'balanced' : mode]
}

export function sumWeights(ws: Weights): number {
  return (Object.keys(ws) as CategoryKey[]).reduce((s, k) => s + ws[k], 0)
}
