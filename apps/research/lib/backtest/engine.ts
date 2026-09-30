/**
 * Score backtesting engine. Pure: takes point-in-time observations and returns
 * bucketed forward-return statistics plus the bias checks it applied.
 *
 * Bias controls
 *  - Look-ahead: an observation is excluded if the data behind the score became
 *    available after the score date (dataAvailableAt > scoreDate).
 *  - Survivorship: delisted companies must be included, with their realised
 *    (often negative) forward returns. The report flags a universe with none.
 *  - Missing forward returns (horizon not yet elapsed) are excluded per horizon,
 *    never filled in.
 */
export type Horizon = 1 | 3 | 5
export const HORIZONS: Horizon[] = [1, 3, 5]
export const BUCKETS = ['80-100', '60-79', '40-59', '<40'] as const
export type Bucket = (typeof BUCKETS)[number]

export interface Observation {
  ticker: string
  scoreDate: string // YYYY-MM-DD
  dataAvailableAt: string // latest filing/data date used by the score
  score: number
  delisted: boolean
  forward: Partial<Record<Horizon, number | null>> // total return, %
  benchmark: Partial<Record<Horizon, number | null>> // benchmark total return over same window, %
}

export interface BucketStats {
  bucket: Bucket
  horizon: Horizon
  n: number
  meanReturn: number | null
  medianReturn: number | null
  meanBenchmark: number | null
  meanExcess: number | null
  hitRate: number | null // % beating benchmark
}

export interface BacktestReport {
  input: number
  used: number
  excludedLookAhead: number
  excludedInvalid: number
  delistedIncluded: number
  warnings: string[]
  stats: BucketStats[]
  monotonic: Partial<Record<Horizon, boolean | null>> // do higher buckets have higher mean excess returns?
}

export function bucketOf(score: number): Bucket {
  if (score >= 80) return '80-100'
  if (score >= 60) return '60-79'
  if (score >= 40) return '40-59'
  return '<40'
}

const med = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function runBacktest(observations: Observation[]): BacktestReport {
  let excludedLookAhead = 0
  let excludedInvalid = 0
  const valid: Observation[] = []
  for (const o of observations) {
    if (!ok(o.score) || o.score < 0 || o.score > 100 || !/^\d{4}-\d{2}-\d{2}$/.test(o.scoreDate) || !/^\d{4}-\d{2}-\d{2}$/.test(o.dataAvailableAt)) {
      excludedInvalid++
      continue
    }
    if (o.dataAvailableAt > o.scoreDate) {
      excludedLookAhead++
      continue
    }
    valid.push(o)
  }
  const stats: BucketStats[] = []
  for (const h of HORIZONS) {
    for (const b of BUCKETS) {
      const rows = valid.filter((o) => bucketOf(o.score) === b && ok(o.forward[h]))
      const rets = rows.map((o) => o.forward[h] as number)
      const withBench = rows.filter((o) => ok(o.benchmark[h]))
      const excess = withBench.map((o) => (o.forward[h] as number) - (o.benchmark[h] as number))
      stats.push({
        bucket: b,
        horizon: h,
        n: rows.length,
        meanReturn: mean(rets),
        medianReturn: med(rets),
        meanBenchmark: mean(withBench.map((o) => o.benchmark[h] as number)),
        meanExcess: mean(excess),
        hitRate: excess.length ? (excess.filter((e) => e > 0).length / excess.length) * 100 : null,
      })
    }
  }
  const monotonic: BacktestReport['monotonic'] = {}
  for (const h of HORIZONS) {
    const ex = BUCKETS.map((b) => stats.find((s) => s.bucket === b && s.horizon === h)!).filter((s) => s.n >= 5 && s.meanExcess !== null).map((s) => s.meanExcess as number)
    monotonic[h] = ex.length < 2 ? null : ex.every((v, i) => i === 0 || ex[i - 1] >= v)
  }
  const delistedIncluded = valid.filter((o) => o.delisted).length
  const warnings: string[] = []
  if (excludedLookAhead) warnings.push(`${excludedLookAhead} observations used data published after their score date and were excluded (look-ahead bias).`)
  if (valid.length && !delistedIncluded) warnings.push('No delisted companies in the sample — results are likely affected by survivorship bias.')
  const small = stats.filter((s) => s.n > 0 && s.n < 30).length
  if (small) warnings.push(`${small} bucket/horizon cells have fewer than 30 observations; treat them as noisy.`)
  if (!valid.length) warnings.push('No usable observations.')
  return { input: observations.length, used: valid.length, excludedLookAhead, excludedInvalid, delistedIncluded, warnings, stats, monotonic }
}

/** CSV columns: ticker,score_date,data_available_at,score,delisted,ret_1y,ret_3y,ret_5y,bench_1y,bench_3y,bench_5y */
export function parseObservationsCsv(csv: string): Observation[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'))
  if (!lines.length) return []
  const head = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const idx = (k: string) => head.indexOf(k)
  const num = (v: string | undefined) => (v === undefined || v.trim() === '' ? null : Number(v))
  return lines.slice(1).map((line) => {
    const c = line.split(',')
    const g = (k: string) => (idx(k) >= 0 ? c[idx(k)]?.trim() : undefined)
    return {
      ticker: g('ticker') ?? '',
      scoreDate: g('score_date') ?? '',
      dataAvailableAt: g('data_available_at') ?? '',
      score: Number(g('score')),
      delisted: /^(1|true|yes)$/i.test(g('delisted') ?? ''),
      forward: { 1: num(g('ret_1y')), 3: num(g('ret_3y')), 5: num(g('ret_5y')) },
      benchmark: { 1: num(g('bench_1y')), 3: num(g('bench_3y')), 5: num(g('bench_5y')) },
    }
  })
}

/**
 * Engine self-test on RANDOM data: scores carry no information about returns,
 * so a correct engine should show no systematic difference between buckets.
 * This demonstrates the calculation only — it is not evidence about the methodology.
 */
export function randomSelfTest(n = 2000, seed = 42): Observation[] {
  let a = seed
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-12))) * Math.cos(2 * Math.PI * rand())
  const out: Observation[] = []
  for (let i = 0; i < n; i++) {
    const year = 2005 + Math.floor(rand() * 15)
    const bench1 = 8 + gauss() * 15
    out.push({
      ticker: `SIM${i}`,
      scoreDate: `${year}-06-30`,
      dataAvailableAt: rand() < 0.02 ? `${year}-09-30` : `${year}-05-15`, // ~2% deliberately leak future data
      score: Math.round(rand() * 100),
      delisted: rand() < 0.06,
      forward: { 1: bench1 + gauss() * 25, 3: 3 * 8 + gauss() * 45, 5: 5 * 8 + gauss() * 60 },
      benchmark: { 1: bench1, 3: 24 + gauss() * 20, 5: 40 + gauss() * 25 },
    })
  }
  return out
}
