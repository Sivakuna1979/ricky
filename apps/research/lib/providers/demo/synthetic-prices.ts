import type { PricePoint } from '@/lib/domain/types'

/** Deterministic PRNG so the synthetic demo series is identical on every render. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(rand: () => number) {
  const u = Math.max(rand(), 1e-12)
  const v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function businessDays(start: Date, end: Date): string[] {
  const out: string[] = []
  const d = new Date(start)
  while (d <= end) {
    const wd = d.getUTCDay()
    if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

/**
 * SYNTHETIC price path: a log-space Brownian bridge between anchor prices.
 * Used only so the demo can exercise charts and technical indicators. It is
 * NOT a market price history and is labelled as synthetic everywhere it is shown.
 */
export function syntheticPriceSeries(anchors: { date: string; price: number }[], dailyVol = 0.017, seed = 7): PricePoint[] {
  const rand = mulberry32(seed)
  const out: PricePoint[] = []
  for (let k = 0; k < anchors.length - 1; k++) {
    const a = anchors[k]
    const b = anchors[k + 1]
    const days = businessDays(new Date(a.date + 'T00:00:00Z'), new Date(b.date + 'T00:00:00Z'))
    const n = days.length - 1
    if (n <= 0) continue
    // random walk, then pin both ends (bridge)
    const walk = [0]
    for (let i = 1; i <= n; i++) walk.push(walk[i - 1] + gaussian(rand) * dailyVol)
    const la = Math.log(a.price)
    const lb = Math.log(b.price)
    for (let i = k === 0 ? 0 : 1; i <= n; i++) {
      const t = i / n
      const logP = la + (lb - la) * t + (walk[i] - walk[n] * t)
      out.push({ date: days[i], close: Math.round(Math.exp(logP) * 100) / 100, volume: Math.round(45e6 + rand() * 40e6) })
    }
  }
  return out
}
