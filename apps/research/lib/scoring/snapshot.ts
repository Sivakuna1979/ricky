import type { CompanySnapshot, Num } from '@/lib/domain/types'
import { interpolate, isNum } from '@/lib/finance/stats'

/**
 * Snapshot scores: a reduced version of the full methodology computed from the
 * handful of headline metrics a screener row carries. Used where a full dataset
 * is not loaded (screener, comparison, portfolio). Always labelled as such and
 * never presented as the full Investment Quality Score.
 */
export interface SnapshotScores {
  kind: 'snapshot' | 'full'
  overall: number | null
  quality: number | null
  profitability: number | null
  growth: number | null
  valuation: number | null
  financial: number | null
  risk: number | null
  metricsUsed: number
}

const s = (v: Num | undefined, xs: number[], ys: number[]) => (isNum(v) ? interpolate(v, xs, ys) : null)
const avg = (vals: (number | null)[]) => {
  const v = vals.filter((x): x is number => x !== null)
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
}

export function snapshotScores(c: CompanySnapshot): SnapshotScores {
  const roic = s(c.roic, [5, 8, 12, 20, 30], [15, 40, 60, 85, 100])
  const opm = s(c.operatingMargin, [5, 10, 20, 30, 40], [25, 45, 70, 88, 100])
  const npm = s(c.netMargin, [3, 8, 15, 25], [25, 50, 75, 95])
  const gm = s(c.grossMargin, [15, 25, 40, 55, 70], [25, 45, 65, 85, 100])
  const rev = s(c.revenueGrowth, [-10, 0, 5, 10, 20], [10, 35, 55, 72, 90])
  const eps = s(c.epsGrowth, [-5, 0, 5, 10, 15, 25], [10, 30, 50, 65, 80, 95])
  const pe = s(c.pe, [10, 15, 20, 30, 45, 70], [90, 78, 62, 40, 22, 10])
  const fy = s(c.fcfYield, [1, 2, 3, 5, 8], [15, 30, 45, 70, 95])
  const peg = s(c.peg, [0.8, 1.2, 1.8, 2.5, 3.5], [90, 72, 52, 32, 15])
  const ev = s(c.evToEbitda, [8, 12, 18, 25, 40], [85, 70, 50, 32, 12])
  const netDebtYears = isNum(c.netDebt) && isNum(c.fcf) && c.fcf > 0 ? c.netDebt / c.fcf : null
  const lev = s(netDebtYears, [-1, 0, 2, 4, 8], [100, 90, 70, 45, 20])
  const de = s(c.debtToEquity, [0.3, 0.8, 1.5, 2.5], [95, 75, 50, 30])
  const fcfPos = isNum(c.fcf) ? (c.fcf > 0 ? 80 : 20) : null

  const profitability = avg([roic, opm, npm])
  const growth = avg([rev, eps])
  const valuation = avg([pe, fy, peg, ev])
  const financial = avg([lev, de, fcfPos])
  const quality = avg([roic, gm])
  // Risk proxy (higher = lower risk): leverage plus valuation stretch.
  const risk = avg([lev, de, pe])
  // Balanced weights restricted to the categories a snapshot can measure.
  const parts: [number | null, number][] = [
    [financial, 15],
    [quality, 15],
    [profitability, 10],
    [growth, 10],
    [fcfPos === null ? null : avg([fcfPos, fy]), 10],
    [valuation, 15],
    [risk, 10],
  ]
  const used = parts.filter(([v]) => v !== null) as [number, number][]
  const w = used.reduce((a, [, x]) => a + x, 0)
  const overall = w ? Math.round(used.reduce((a, [v, x]) => a + v * x, 0) / w) : null
  const metricsUsed = [roic, opm, npm, gm, rev, eps, pe, fy, peg, ev, lev, de, fcfPos].filter((x) => x !== null).length
  return { kind: 'snapshot', overall, quality, profitability, growth, valuation, financial, risk, metricsUsed }
}
