/**
 * Core domain model. Every provider adapter maps its payloads into these
 * shapes; the finance, scoring and UI layers only ever see these types.
 *
 * Rule: a missing number is `null`, never 0 and never a guess. The UI renders
 * `null` as "Data unavailable".
 */

export type Num = number | null

/** How much a figure can be trusted, from most to least authoritative. */
export type SourceTier =
  | 'filing' // primary regulatory filing (10-K, 10-Q, 20-F…)
  | 'provider' // licensed data vendor, normalised from filings
  | 'derived' // calculated in code from other sourced figures
  | 'estimate' // third-party forward estimates (analysts)
  | 'editorial' // structured qualitative assessment with cited evidence
  | 'demo' // illustrative demo dataset — never presented as real

export interface SourceRef {
  id: string
  name: string
  tier: SourceTier
  url?: string
  /** Reporting period the figures relate to, e.g. "FY2015–FY2025". */
  period?: string
  /** ISO date the data was retrieved / last updated. */
  updated: string
  note?: string
}

export type DataMode = 'demo' | 'live'

export interface CompanyProfile {
  ticker: string
  name: string
  exchange: string
  country: string
  currency: string
  sector: string
  industry: string
  description: string
  website?: string
  cik?: string
  fiscalYearEndMonth?: number
  ipoDate?: string
  employees?: Num
  ceo?: string
  ceoSince?: number
  sourceId: string
}

export interface Quote {
  price: Num
  change: Num
  changePct: Num
  marketCap: Num
  yearHigh: Num
  yearLow: Num
  volume: Num
  avgVolume: Num
  asOf: string
  sourceId: string
}

export interface PricePoint {
  date: string // YYYY-MM-DD
  close: number
  volume?: number
}

/** One fiscal year. Money in reporting currency (units, not millions). */
export interface AnnualFinancials {
  fiscalYear: number
  periodEnd: string
  sourceId: string
  // Income statement
  revenue: Num
  costOfRevenue: Num
  grossProfit: Num
  researchAndDevelopment: Num
  sellingGeneralAdmin: Num
  operatingIncome: Num
  interestExpense: Num
  pretaxIncome: Num
  incomeTax: Num
  netIncome: Num
  epsDiluted: Num
  sharesDiluted: Num
  ebitda: Num
  depreciation: Num
  // Balance sheet
  cash: Num
  shortTermInvestments: Num
  longTermInvestments: Num
  receivables: Num
  inventory: Num
  currentAssets: Num
  netPPE: Num
  goodwill: Num
  intangibles: Num
  totalAssets: Num
  currentLiabilities: Num
  totalLiabilities: Num
  shortTermDebt: Num
  longTermDebt: Num
  totalDebt: Num
  equity: Num
  // Cash flow (outflows stored as positive numbers)
  operatingCashFlow: Num
  capex: Num
  freeCashFlow: Num
  stockBasedCompensation: Num
  dividendsPaid: Num
  buybacks: Num
  acquisitions: Num
  dividendPerShare: Num
  /** Share price at fiscal year end — used for historical multiples. */
  fiscalYearEndPrice: Num
}

export interface NamedValue {
  name: string
  value: number
}

export interface SegmentBreakdown {
  fiscalYear: number
  sourceId: string
  byProduct: NamedValue[]
  byGeography: NamedValue[]
}

export interface AnalystEstimates {
  sourceId: string
  analystCount: Num
  targetLow: Num
  targetMedian: Num
  targetMean: Num
  targetHigh: Num
  revenueNextFY: Num
  epsNextFY: Num
  epsNextFY2: Num
  /** Consensus long-term EPS growth, % per year. */
  longTermEpsGrowth: Num
  asOf: string
}

export interface EarningsQuarter {
  period: string // e.g. "Q3 FY2026"
  reportDate: string
  epsActual: Num
  epsEstimate: Num
  revenueActual: Num
  revenueEstimate: Num
}

export interface Filing {
  form: string
  filedAt: string
  description: string
  url: string
}

export type MoatSource =
  | 'brand'
  | 'network_effects'
  | 'switching_costs'
  | 'cost_advantage'
  | 'intellectual_property'
  | 'distribution'
  | 'scale'
  | 'ecosystem'
  | 'data'
  | 'regulatory'

export interface MoatAssessment {
  source: MoatSource
  /** 0 none · 1 weak · 2 moderate · 3 strong */
  strength: 0 | 1 | 2 | 3
  evidence: string
}

export type RiskKey =
  | 'debt'
  | 'valuation'
  | 'competition'
  | 'regulation'
  | 'customer_concentration'
  | 'supplier_concentration'
  | 'currency'
  | 'geopolitical'
  | 'disruption'
  | 'key_person'
  | 'litigation'
  | 'cyclicality'
  | 'commodity'
  | 'interest_rates'
  | 'economic_slowdown'
  | 'dilution'

export interface RiskFactor {
  key: RiskKey
  /** 1 low · 2 moderate · 3 elevated · 4 high */
  level: 1 | 2 | 3 | 4
  evidence: string
}

export type Cyclicality = 'defensive' | 'moderately_cyclical' | 'highly_cyclical'

export interface OutlookItem {
  horizon: '1Y' | '3Y' | '5Y' | '10Y'
  statements: { kind: 'fact' | 'expectation' | 'assumption' | 'scenario' | 'uncertainty'; text: string }[]
}

/**
 * Structured qualitative inputs. Produced by analysts (or AI-drafted then
 * human-reviewed) with evidence — never scored by an LLM at request time.
 */
export interface QualitativeInputs {
  sourceId: string
  businessModel: string[]
  revenueStreams: string[]
  moat: MoatAssessment[]
  risks: RiskFactor[]
  cyclicality: Cyclicality
  cyclicalityReason: string
  industry: {
    overview: string
    trends: string[]
    barriers: string
    regulation: string
    concentration: string
    opportunities: string[]
    threats: string[]
  }
  macroSensitivities: { factor: string; relevance: 'high' | 'medium' | 'low'; explanation: string }[]
  geographicNotes: { manufacturing: string; suppliers: string; currency: string; political: string }
  concentrationNotes: string[]
  marketOpportunity: 1 | 2 | 3 // Fisher-style runway, 1 limited · 3 large
  businessSimplicity: 1 | 2 | 3
  outlook: OutlookItem[]
  monitor: string[]
}

/** Compact metrics for peers / screener universe rows. */
export interface CompanySnapshot {
  ticker: string
  name: string
  sector: string
  industry: string
  exchange: string
  country: string
  marketCap: Num
  revenue: Num
  revenueGrowth: Num // %
  pe: Num
  forwardPe: Num
  operatingMargin: Num // %
  netMargin: Num // %
  roe: Num // %
  roic: Num // %
  totalDebt: Num
  netDebt: Num
  fcf: Num
  fcfGrowth: Num // %
  fcfYield: Num // %
  evToEbitda: Num
  dividendYield: Num // %
  sourceId: string
}

export interface IndustryBenchmarks {
  label: string
  sourceId: string
  grossMargin: Num
  operatingMargin: Num
  netMargin: Num
  roic: Num
  roe: Num
  revenueGrowth: Num
  pe: Num
  forwardPe: Num
  ps: Num
  pb: Num
  evToEbitda: Num
  pfcf: Num
  currentRatio: Num
  debtToEquity: Num
}

export interface CompanyDataset {
  mode: DataMode
  profile: CompanyProfile
  quote: Quote
  annual: AnnualFinancials[] // ascending by fiscalYear
  prices: PricePoint[] // ascending by date
  pricesSynthetic: boolean
  segments: SegmentBreakdown | null
  estimates: AnalystEstimates | null
  earnings: EarningsQuarter[]
  filings: Filing[]
  filingsIndexUrl?: string
  qualitative: QualitativeInputs | null
  peers: CompanySnapshot[]
  industry: IndustryBenchmarks | null
  ownership: { institutionalPct: Num; insiderPct: Num; sourceId: string } | null
  shortInterest: { pctFloat: Num; daysToCover: Num; sourceId: string } | null
  sources: Record<string, SourceRef>
  generatedAt: string
}
