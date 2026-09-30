import type { Num, PricePoint } from '@/lib/domain/types'

export function sma(values: number[], period: number): Num {
  if (values.length < period) return null
  const slice = values.slice(-period)
  return slice.reduce((s, v) => s + v, 0) / period
}

function emaSeries(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const out: number[] = []
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1] * (1 - k)))
  return out
}

/** Wilder's RSI. */
export function rsi(values: number[], period = 14): Num {
  if (values.length <= period) return null
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1]
    if (d >= 0) gain += d
    else loss -= d
  }
  gain /= period
  loss /= period
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1]
    gain = (gain * (period - 1) + Math.max(d, 0)) / period
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period
  }
  if (loss === 0) return 100
  return 100 - 100 / (1 + gain / loss)
}

export function macd(values: number[]) {
  if (values.length < 35) return { macd: null, signal: null, histogram: null }
  const e12 = emaSeries(values, 12)
  const e26 = emaSeries(values, 26)
  const line = e12.map((v, i) => v - e26[i])
  const signal = emaSeries(line.slice(25), 9)
  const m = line[line.length - 1]
  const s = signal[signal.length - 1]
  return { macd: m, signal: s, histogram: m - s }
}

function periodReturn(prices: PricePoint[], tradingDays: number): Num {
  if (prices.length <= tradingDays) return null
  const a = prices[prices.length - 1 - tradingDays].close
  const b = prices[prices.length - 1].close
  return (b / a - 1) * 100
}

/** Support/resistance: lowest low and highest high over the last ~3 months. */
function levels(prices: PricePoint[]) {
  const recent = prices.slice(-63).map((p) => p.close)
  if (!recent.length) return { support: null, resistance: null }
  return { support: Math.min(...recent), resistance: Math.max(...recent) }
}

export interface TechnicalSnapshot {
  price: Num
  high52: Num
  low52: Num
  sma50: Num
  sma100: Num
  sma200: Num
  rsi14: Num
  macd: Num
  macdSignal: Num
  macdHistogram: Num
  support: Num
  resistance: Num
  return1m: Num
  return6m: Num
  return12m: Num
  avgVolume50: Num
  lastVolume: Num
}

export function technicalSnapshot(prices: PricePoint[]): TechnicalSnapshot {
  const closes = prices.map((p) => p.close)
  const year = closes.slice(-252)
  const m = macd(closes)
  const lv = levels(prices)
  const vols = prices.slice(-50).map((p) => p.volume ?? 0)
  return {
    price: closes.length ? closes[closes.length - 1] : null,
    high52: year.length ? Math.max(...year) : null,
    low52: year.length ? Math.min(...year) : null,
    sma50: sma(closes, 50),
    sma100: sma(closes, 100),
    sma200: sma(closes, 200),
    rsi14: rsi(closes.slice(-300)),
    macd: m.macd,
    macdSignal: m.signal,
    macdHistogram: m.histogram,
    support: lv.support,
    resistance: lv.resistance,
    return1m: periodReturn(prices, 21),
    return6m: periodReturn(prices, 126),
    return12m: periodReturn(prices, 252),
    avgVolume50: vols.length ? vols.reduce((s, v) => s + v, 0) / vols.length : null,
    lastVolume: prices.length ? prices[prices.length - 1].volume ?? null : null,
  }
}

/** Simple moving average series for charting. */
export function smaSeries(closes: number[], period: number): (number | null)[] {
  const out: (number | null)[] = []
  let s = 0
  closes.forEach((v, i) => {
    s += v
    if (i >= period) s -= closes[i - period]
    out.push(i >= period - 1 ? s / period : null)
  })
  return out
}
