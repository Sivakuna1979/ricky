import type { UniverseRow } from './universe'

export type NumericField =
  | 'marketCap'
  | 'revenueGrowth'
  | 'epsGrowth'
  | 'pe'
  | 'forwardPe'
  | 'peg'
  | 'ps'
  | 'evToEbitda'
  | 'fcfYield'
  | 'dividendYield'
  | 'roe'
  | 'roic'
  | 'grossMargin'
  | 'operatingMargin'
  | 'netMargin'
  | 'debtToEquity'
  | 'fcf'
  | 'score.overall'
  | 'score.quality'
  | 'score.valuation'
  | 'score.growth'
  | 'score.financial'
  | 'score.risk'
  | 'moat'

export type TextField = 'sector' | 'industry' | 'country' | 'exchange'

export interface FieldDef {
  key: NumericField
  label: string
  unit: '%' | '×' | '$B' | 'score' | '$'
  group: 'Size' | 'Growth' | 'Valuation' | 'Profitability' | 'Balance sheet' | 'Scores'
  advanced: boolean
}

export const FIELDS: FieldDef[] = [
  { key: 'marketCap', label: 'Market cap', unit: '$B', group: 'Size', advanced: false },
  { key: 'revenueGrowth', label: 'Revenue growth', unit: '%', group: 'Growth', advanced: false },
  { key: 'epsGrowth', label: 'EPS growth', unit: '%', group: 'Growth', advanced: true },
  { key: 'pe', label: 'P/E', unit: '×', group: 'Valuation', advanced: false },
  { key: 'forwardPe', label: 'Forward P/E', unit: '×', group: 'Valuation', advanced: true },
  { key: 'peg', label: 'PEG', unit: '×', group: 'Valuation', advanced: true },
  { key: 'ps', label: 'Price / sales', unit: '×', group: 'Valuation', advanced: true },
  { key: 'evToEbitda', label: 'EV / EBITDA', unit: '×', group: 'Valuation', advanced: true },
  { key: 'fcfYield', label: 'FCF yield', unit: '%', group: 'Valuation', advanced: true },
  { key: 'dividendYield', label: 'Dividend yield', unit: '%', group: 'Valuation', advanced: false },
  { key: 'roe', label: 'ROE', unit: '%', group: 'Profitability', advanced: true },
  { key: 'roic', label: 'ROIC', unit: '%', group: 'Profitability', advanced: true },
  { key: 'grossMargin', label: 'Gross margin', unit: '%', group: 'Profitability', advanced: true },
  { key: 'operatingMargin', label: 'Operating margin', unit: '%', group: 'Profitability', advanced: true },
  { key: 'netMargin', label: 'Net margin', unit: '%', group: 'Profitability', advanced: true },
  { key: 'fcf', label: 'Free cash flow', unit: '$B', group: 'Profitability', advanced: true },
  { key: 'debtToEquity', label: 'Debt / equity', unit: '×', group: 'Balance sheet', advanced: true },
  { key: 'score.overall', label: 'Quality score (overall)', unit: 'score', group: 'Scores', advanced: true },
  { key: 'score.quality', label: 'Business quality score', unit: 'score', group: 'Scores', advanced: true },
  { key: 'score.valuation', label: 'Valuation score', unit: 'score', group: 'Scores', advanced: true },
  { key: 'score.growth', label: 'Growth score', unit: 'score', group: 'Scores', advanced: true },
  { key: 'score.financial', label: 'Financial strength score', unit: 'score', group: 'Scores', advanced: true },
  { key: 'score.risk', label: 'Risk score (higher = safer)', unit: 'score', group: 'Scores', advanced: true },
  { key: 'moat', label: 'Moat score', unit: 'score', group: 'Scores', advanced: true },
]

export const fieldDef = (k: NumericField) => FIELDS.find((f) => f.key === k)!

export interface NumericFilter {
  kind: 'num'
  field: NumericField
  op: 'gt' | 'lt'
  value: number
  source?: string // phrase that produced it
}
export interface TextFilter {
  kind: 'text'
  field: TextField
  values: string[]
  source?: string
}
export type Filter = NumericFilter | TextFilter

/** Values in $B for money fields so users type "10" for $10B. */
export function readField(row: UniverseRow, f: NumericField): number | null {
  let v: number | null | undefined
  if (f.startsWith('score.')) v = row.scores[f.slice(6) as keyof typeof row.scores] as number | null
  else v = (row as unknown as Record<string, number | null | undefined>)[f]
  if (v === undefined || v === null || !Number.isFinite(v)) return null
  return fieldDef(f).unit === '$B' ? v / 1e9 : v
}

/** A row with missing data for a numeric filter does NOT pass (no data is not evidence). */
export function applyFilters(rows: UniverseRow[], filters: Filter[]): UniverseRow[] {
  return rows.filter((r) =>
    filters.every((f) => {
      if (f.kind === 'text') return f.values.length === 0 || f.values.some((v) => (r[f.field] ?? '').toLowerCase().includes(v.toLowerCase()))
      const v = readField(r, f.field)
      if (v === null) return false
      return f.op === 'gt' ? v > f.value : v < f.value
    }),
  )
}

export function describeFilter(f: Filter): string {
  if (f.kind === 'text') return `${f.field}: ${f.values.join(' or ')}`
  const d = fieldDef(f.field)
  const unit = d.unit === '%' ? '%' : d.unit === '×' ? '×' : d.unit === '$B' ? 'B' : ''
  const prefix = d.unit === '$B' ? '$' : ''
  return `${d.label} ${f.op === 'gt' ? '>' : '<'} ${prefix}${f.value}${unit}`
}

// ───────────────────────── Plain-English parser ─────────────────────────

const SYNONYMS: [RegExp, NumericField][] = [
  [/\broic\b|return on invested capital|return on capital/, 'roic'],
  [/\broe\b|return on equity/, 'roe'],
  [/revenue growth|sales growth|top[- ]line growth/, 'revenueGrowth'],
  [/eps growth|earnings growth|profit growth/, 'epsGrowth'],
  [/forward p\/?e|forward pe/, 'forwardPe'],
  [/\bpeg\b/, 'peg'],
  [/\bp\/?e\b|price[- ]to[- ]earnings|pe ratio/, 'pe'],
  [/price[- ]to[- ]sales|\bp\/?s\b/, 'ps'],
  [/ev\/?ebitda|ev to ebitda/, 'evToEbitda'],
  [/fcf yield|free cash flow yield/, 'fcfYield'],
  [/dividend yield|\byield\b/, 'dividendYield'],
  [/gross margin/, 'grossMargin'],
  [/operating margin|op(erating)? margin/, 'operatingMargin'],
  [/net margin|profit margin/, 'netMargin'],
  [/debt[- ]to[- ]equity|debt\/equity|\bd\/e\b/, 'debtToEquity'],
  [/market cap(italisation|italization)?/, 'marketCap'],
  [/moat score|\bmoat\b/, 'moat'],
  [/valuation score/, 'score.valuation'],
  [/quality score|investment quality/, 'score.overall'],
  [/growth score/, 'score.growth'],
  [/risk score/, 'score.risk'],
]

const GT = /(above|over|greater than|more than|higher than|at least|exceeding|>=?|min(imum)?)/
const LT = /(below|under|less than|lower than|at most|<=?|max(imum)?)/

const PHRASES: [RegExp, Filter[]][] = [
  [/\bprofitable\b/, [{ kind: 'num', field: 'netMargin', op: 'gt', value: 0 }]],
  [/positive (fcf|free cash flow)/, [{ kind: 'num', field: 'fcf', op: 'gt', value: 0 }]],
  [/reasonabl[ey] (valuation|valued|priced)|reasonable price|fair(ly)? valued/, [{ kind: 'num', field: 'score.valuation', op: 'gt', value: 40 }]],
  [/\b(cheap|undervalued|inexpensive)\b/, [{ kind: 'num', field: 'score.valuation', op: 'gt', value: 60 }]],
  [/low debt|little debt|strong balance sheet/, [{ kind: 'num', field: 'score.financial', op: 'gt', value: 65 }]],
  [/(pays? (a )?dividends?|dividend payers?)/, [{ kind: 'num', field: 'dividendYield', op: 'gt', value: 0 }]],
  [/high[- ]quality|quality compan/, [{ kind: 'num', field: 'score.quality', op: 'gt', value: 70 }]],
  [/fast[- ]growing|high[- ]growth/, [{ kind: 'num', field: 'revenueGrowth', op: 'gt', value: 15 }]],
  [/mega[- ]cap/, [{ kind: 'num', field: 'marketCap', op: 'gt', value: 200 }]],
  [/large[- ]cap/, [{ kind: 'num', field: 'marketCap', op: 'gt', value: 10 }]],
  [/mid[- ]cap/, [{ kind: 'num', field: 'marketCap', op: 'gt', value: 2 }, { kind: 'num', field: 'marketCap', op: 'lt', value: 10 }]],
  [/small[- ]cap/, [{ kind: 'num', field: 'marketCap', op: 'lt', value: 2 }]],
  [/wide moat/, [{ kind: 'num', field: 'moat', op: 'gt', value: 72 }]],
]

const SECTORS = ['technology', 'healthcare', 'consumer cyclical', 'consumer defensive', 'communication services', 'financial', 'industrials', 'energy', 'utilities', 'real estate', 'materials']

export interface ParseResult {
  filters: Filter[]
  unparsed: string[]
}

/**
 * Deterministic translation of a plain-English screen into explicit filters.
 * Every generated filter is shown to the user as an editable chip before it runs;
 * fragments that could not be understood are listed rather than guessed.
 */
export function parseQuery(input: string): ParseResult {
  const text = input.toLowerCase().replace(/[“”]/g, '"')
  const clauses = text
    .replace(/^(find|show( me)?|list|screen( for)?|companies|stocks)\s+/g, '')
    .split(/,|;|\band\b|\bwith\b|\bthat\b|\bwhich\b|\bhaving\b/)
    .map((c) => c.trim())
    .filter(Boolean)
  const filters: Filter[] = []
  const unparsed: string[] = []
  for (const clause of clauses) {
    let matched = false
    for (const [re, fs] of PHRASES) {
      if (re.test(clause)) {
        fs.forEach((f) => filters.push({ ...f, source: clause }))
        matched = true
      }
    }
    const num = clause.match(/(-?\d+(\.\d+)?)\s*(%|x|×|b|bn|billion|t|tn|trillion)?/)
    const field = SYNONYMS.find(([re]) => re.test(clause))?.[1]
    if (field && num) {
      let value = Number(num[1])
      if (field === 'marketCap' && num[3] && /^t/.test(num[3])) value *= 1000
      const op = LT.test(clause) ? 'lt' : GT.test(clause) ? 'gt' : null
      if (op) {
        filters.push({ kind: 'num', field, op, value, source: clause })
        matched = true
      }
    }
    const sector = SECTORS.find((s) => clause.includes(s) || (s === 'technology' && /\btech\b/.test(clause)))
    if (sector) {
      filters.push({ kind: 'text', field: 'sector', values: [sector], source: clause })
      matched = true
    }
    if (!matched && !/^(find|show|companies|stocks|me|the|a)$/.test(clause)) unparsed.push(clause)
  }
  // Collapse duplicates (same field+op): keep the last one mentioned.
  const seen = new Map<string, Filter>()
  for (const f of filters) seen.set(f.kind === 'num' ? `${f.field}:${f.op}` : `${f.field}`, f)
  return { filters: [...seen.values()], unparsed }
}
