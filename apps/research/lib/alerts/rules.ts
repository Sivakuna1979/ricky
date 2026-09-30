/**
 * Alert rules. Price/valuation/score rules are evaluated against current data
 * (in the browser for instant feedback, and by /api/cron/alerts for delivery).
 * Event rules (earnings, filings, dividends, estimates, news) need the matching
 * data feed and report "waiting for data feed" until one is connected.
 */
export type AlertKind =
  | 'price_above'
  | 'price_below'
  | 'daily_move'
  | 'pe_below'
  | 'pe_above'
  | 'score_below'
  | 'score_above'
  | 'earnings'
  | 'new_filing'
  | 'dividend_change'
  | 'estimate_change'
  | 'major_news'

export interface AlertRule {
  id: string
  ticker: string
  kind: AlertKind
  value?: number
  active: boolean
}

export const ALERT_KINDS: { kind: AlertKind; label: string; needsValue: boolean; unit?: string; feed?: string }[] = [
  { kind: 'price_above', label: 'Price rises above', needsValue: true, unit: '$' },
  { kind: 'price_below', label: 'Price falls below', needsValue: true, unit: '$' },
  { kind: 'daily_move', label: 'Daily move larger than', needsValue: true, unit: '%' },
  { kind: 'pe_below', label: 'Valuation enters range: P/E below', needsValue: true, unit: '×' },
  { kind: 'pe_above', label: 'P/E rises above', needsValue: true, unit: '×' },
  { kind: 'score_below', label: 'Quality score falls below', needsValue: true },
  { kind: 'score_above', label: 'Quality score rises above', needsValue: true },
  { kind: 'earnings', label: 'Earnings released', needsValue: false, feed: 'earnings calendar' },
  { kind: 'new_filing', label: 'New SEC filing', needsValue: false, feed: 'SEC EDGAR' },
  { kind: 'dividend_change', label: 'Dividend change', needsValue: false, feed: 'dividends' },
  { kind: 'estimate_change', label: 'Analyst estimate change', needsValue: false, feed: 'estimates history' },
  { kind: 'major_news', label: 'Major company news', needsValue: false, feed: 'news' },
]

export interface AlertInputs {
  price?: number | null
  changePct?: number | null
  pe?: number | null
  score?: number | null
}

export type AlertStatus = { state: 'triggered' | 'watching' | 'no_data' | 'awaiting_feed'; detail: string }

export function evaluateAlert(rule: AlertRule, x: AlertInputs): AlertStatus {
  const def = ALERT_KINDS.find((k) => k.kind === rule.kind)!
  if (def.feed) return { state: 'awaiting_feed', detail: `Needs the ${def.feed} feed` }
  const v = rule.value ?? NaN
  const check = (cur: number | null | undefined, hit: (c: number) => boolean, label: string): AlertStatus =>
    cur === null || cur === undefined || !Number.isFinite(cur) ? { state: 'no_data', detail: `${label} unavailable` } : hit(cur) ? { state: 'triggered', detail: `${label} ${cur.toFixed(2)}` } : { state: 'watching', detail: `${label} ${cur.toFixed(2)}` }
  switch (rule.kind) {
    case 'price_above':
      return check(x.price, (c) => c > v, 'Price')
    case 'price_below':
      return check(x.price, (c) => c < v, 'Price')
    case 'daily_move':
      return check(x.changePct, (c) => Math.abs(c) > v, 'Daily move %')
    case 'pe_below':
      return check(x.pe, (c) => c < v, 'P/E')
    case 'pe_above':
      return check(x.pe, (c) => c > v, 'P/E')
    case 'score_below':
      return check(x.score, (c) => c < v, 'Score')
    case 'score_above':
      return check(x.score, (c) => c > v, 'Score')
    default:
      return { state: 'awaiting_feed', detail: 'Needs a data feed' }
  }
}
