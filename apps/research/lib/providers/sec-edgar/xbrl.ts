import type { AnnualFinancials, Num } from '@/lib/domain/types'

/**
 * Parser for SEC XBRL "company facts" (https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json).
 *
 * Primary-source annual statements for every US filer, free. Rules:
 *  - Only annual reports (10-K / 10-K/A / 20-F / 40-F) with full-year durations (300–400 days) are used for flow items.
 *  - Balance-sheet items are instants at the fiscal-year-end date.
 *  - Each fiscal year is identified from the period a report actually covers (not the comparative columns).
 *  - When a figure was restated, the most recently filed value wins.
 *  - Concept names changed over time (e.g. SalesRevenueNet → RevenueFromContract…); candidates are tried per year.
 *  - Anything not found is null. Nothing is estimated.
 */
export interface XbrlFact {
  start?: string
  end: string
  val: number
  fy?: number
  fp?: string
  form: string
  filed: string
  accn: string
  frame?: string
}
export interface CompanyFacts {
  cik: number
  entityName: string
  facts: Record<string, Record<string, { label?: string; units: Record<string, XbrlFact[]> }>>
}

const ANNUAL_FORMS = new Set(['10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A', '10-KT'])

const days = (a: string, b: string) => (new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 86_400_000

function facts(cf: CompanyFacts, concept: string, unit = 'USD', taxonomy = 'us-gaap'): XbrlFact[] {
  return cf.facts[taxonomy]?.[concept]?.units[unit] ?? []
}

/** Fiscal-year-end dates → fiscal year, from the period each annual report covers. */
export function fiscalYearEnds(cf: CompanyFacts): Map<string, number> {
  const anchors = ['NetIncomeLoss', 'Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'Assets', 'StockholdersEquity', 'NetCashProvidedByUsedInOperatingActivities']
  const byAccn = new Map<string, { end: string; fy?: number }>()
  for (const c of anchors) {
    for (const f of facts(cf, c)) {
      if (!ANNUAL_FORMS.has(f.form) || f.fp !== 'FY') continue
      const cur = byAccn.get(f.accn)
      if (!cur || f.end > cur.end) byAccn.set(f.accn, { end: f.end, fy: f.fy })
    }
  }
  const out = new Map<string, number>()
  for (const { end, fy } of byAccn.values()) {
    // `fy` is the filing's fiscal-year focus; fall back to the end date's year.
    const year = fy ?? Number(end.slice(0, 4))
    const existing = [...out.entries()].find(([, y]) => y === year)
    if (existing && existing[0] >= end) continue
    if (existing) out.delete(existing[0])
    out.set(end, year)
  }
  return new Map([...out.entries()].sort((a, b) => a[0].localeCompare(b[0])))
}

function pick(cf: CompanyFacts, candidates: string[], end: string, kind: 'duration' | 'instant', unit = 'USD', taxonomy = 'us-gaap'): Num {
  for (const c of candidates) {
    const matches = facts(cf, c, unit, taxonomy).filter((f) => {
      if (f.end !== end) return false
      if (kind === 'instant') return !f.start
      if (!f.start || !ANNUAL_FORMS.has(f.form)) return false
      const d = days(f.start, f.end)
      return d >= 300 && d <= 400
    })
    if (matches.length) return matches.sort((a, b) => b.filed.localeCompare(a.filed))[0].val
  }
  return null
}

const sumPresent = (...v: Num[]) => {
  const p = v.filter((x): x is number => x !== null)
  return p.length ? p.reduce((a, b) => a + b, 0) : null
}

const SPLIT_FACTORS = [2, 3, 4, 5, 7, 8, 10, 15, 20]

/**
 * Filings made before a stock split report pre-split share counts and per-share
 * figures, while later filings and price histories are split-adjusted. Detect a
 * split as a year-over-year share-count jump close to a standard ratio (or its
 * inverse for reverse splits) and restate earlier years onto today's share basis.
 */
export function adjustForSplits(rows: AnnualFinancials[]): { rows: AnnualFinancials[]; splits: { fiscalYear: number; factor: number }[] } {
  const out = rows.map((r) => ({ ...r }))
  const splits: { fiscalYear: number; factor: number }[] = []
  for (let i = out.length - 1; i > 0; i--) {
    const cur = out[i].sharesDiluted
    const prev = out[i - 1].sharesDiluted
    if (!cur || !prev) continue
    const ratio = cur / prev
    const fwd = SPLIT_FACTORS.find((k) => Math.abs(ratio - k) / k < 0.08)
    const rev = SPLIT_FACTORS.find((k) => Math.abs(1 / ratio - k) / k < 0.08)
    const factor = fwd ?? (rev ? 1 / rev : null)
    if (!factor) continue
    splits.push({ fiscalYear: out[i].fiscalYear, factor })
    for (let j = 0; j < i; j++) {
      const r = out[j]
      if (r.sharesDiluted !== null) r.sharesDiluted *= factor
      if (r.epsDiluted !== null) r.epsDiluted /= factor
      if (r.dividendPerShare !== null) r.dividendPerShare /= factor
    }
  }
  return { rows: out, splits }
}

export function annualFromFacts(cf: CompanyFacts, years = 11, sourceId = 'sec-xbrl'): AnnualFinancials[] {
  return adjustForSplits(rawAnnualFromFacts(cf, years, sourceId)).rows
}

function rawAnnualFromFacts(cf: CompanyFacts, years: number, sourceId: string): AnnualFinancials[] {
  const ends = [...fiscalYearEnds(cf).entries()].slice(-years)
  return ends.map(([end, fy]) => {
    const d = (...c: string[]) => pick(cf, c, end, 'duration')
    const i = (...c: string[]) => pick(cf, c, end, 'instant')
    const revenue = d('RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueGoodsNet')
    const costOfRevenue = d('CostOfRevenue', 'CostOfGoodsAndServicesSold', 'CostOfGoodsSold', 'CostOfGoodsAndServiceExcludingDepreciationDepletionAndAmortization')
    const grossProfit = d('GrossProfit') ?? (revenue !== null && costOfRevenue !== null ? revenue - costOfRevenue : null)
    const operatingIncome = d('OperatingIncomeLoss')
    const depreciation = d('DepreciationDepletionAndAmortization', 'DepreciationAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'Depreciation')
    const ocf = d('NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations')
    const capex = d('PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets')
    const equity = i('StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest')
    const totalAssets = i('Assets')
    const ltDebt = i('LongTermDebtNoncurrent', 'LongTermDebtAndCapitalLeaseObligations', 'LongTermDebt')
    const stDebt = sumPresent(i('LongTermDebtCurrent', 'LongTermDebtAndCapitalLeaseObligationsCurrent'), i('CommercialPaper'), i('ShortTermBorrowings', 'OtherShortTermBorrowings'))
    const totalLiabilities =
      i('Liabilities') ?? (totalAssets !== null && i('StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', 'StockholdersEquity') !== null ? totalAssets - (i('StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', 'StockholdersEquity') as number) : null)
    return {
      fiscalYear: fy,
      periodEnd: end,
      sourceId,
      revenue,
      costOfRevenue,
      grossProfit,
      researchAndDevelopment: d('ResearchAndDevelopmentExpense', 'ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost'),
      sellingGeneralAdmin: d('SellingGeneralAndAdministrativeExpense'),
      operatingIncome,
      interestExpense: d('InterestExpense', 'InterestExpenseNonoperating', 'InterestExpenseDebt'),
      pretaxIncome: d('IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments'),
      incomeTax: d('IncomeTaxExpenseBenefit'),
      netIncome: d('NetIncomeLoss', 'ProfitLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic'),
      epsDiluted: pick(cf, ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted'], end, 'duration', 'USD/shares'),
      sharesDiluted: pick(cf, ['WeightedAverageNumberOfDilutedSharesOutstanding'], end, 'duration', 'shares'),
      ebitda: operatingIncome !== null && depreciation !== null ? operatingIncome + depreciation : null,
      depreciation,
      cash: i('CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'),
      shortTermInvestments: i('MarketableSecuritiesCurrent', 'ShortTermInvestments', 'AvailableForSaleSecuritiesDebtSecuritiesCurrent'),
      longTermInvestments: i('MarketableSecuritiesNoncurrent', 'LongTermInvestments', 'AvailableForSaleSecuritiesDebtSecuritiesNoncurrent'),
      receivables: i('AccountsReceivableNetCurrent'),
      inventory: i('InventoryNet'),
      currentAssets: i('AssetsCurrent'),
      netPPE: i('PropertyPlantAndEquipmentNet'),
      goodwill: i('Goodwill'),
      intangibles: i('IntangibleAssetsNetExcludingGoodwill', 'FiniteLivedIntangibleAssetsNet'),
      totalAssets,
      currentLiabilities: i('LiabilitiesCurrent'),
      totalLiabilities,
      shortTermDebt: stDebt,
      longTermDebt: ltDebt,
      totalDebt: sumPresent(stDebt, ltDebt),
      equity,
      operatingCashFlow: ocf,
      capex,
      freeCashFlow: ocf !== null && capex !== null ? ocf - capex : null,
      stockBasedCompensation: d('ShareBasedCompensation', 'AllocatedShareBasedCompensationExpense'),
      dividendsPaid: d('PaymentsOfDividends', 'PaymentsOfDividendsCommonStock'),
      buybacks: d('PaymentsForRepurchaseOfCommonStock'),
      acquisitions: d('PaymentsToAcquireBusinessesNetOfCashAcquired'),
      dividendPerShare: pick(cf, ['CommonStockDividendsPerShareDeclared', 'CommonStockDividendsPerShareCashPaid'], end, 'duration', 'USD/shares'),
      fiscalYearEndPrice: null,
    }
  })
}

/** Latest cover-page shares outstanding (dei). */
export function sharesOutstanding(cf: CompanyFacts): Num {
  const f = facts(cf, 'EntityCommonStockSharesOutstanding', 'shares', 'dei')
  if (!f.length) return null
  return [...f].sort((a, b) => b.end.localeCompare(a.end) || b.filed.localeCompare(a.filed))[0].val
}

export function latestFiled(cf: CompanyFacts): string | null {
  let latest: string | null = null
  for (const tax of Object.values(cf.facts)) for (const c of Object.values(tax)) for (const u of Object.values(c.units)) for (const f of u) if (ANNUAL_FORMS.has(f.form) && (!latest || f.filed > latest)) latest = f.filed
  return latest
}

/** Broad sector from SEC SIC code (Standard Industrial Classification). */
export function sectorFromSic(sic: number | null): string {
  if (sic === null || !Number.isFinite(sic)) return '—'
  if (sic >= 100 && sic < 1000) return 'Basic Materials'
  if (sic >= 1000 && sic < 1500) return sic >= 1300 && sic < 1400 ? 'Energy' : 'Basic Materials'
  if (sic >= 1500 && sic < 1800) return 'Industrials'
  if (sic === 2834 || sic === 2835 || sic === 2836 || (sic >= 3840 && sic < 3852) || (sic >= 8000 && sic < 8100)) return 'Healthcare'
  if ((sic >= 3570 && sic < 3580) || (sic >= 3670 && sic < 3680) || (sic >= 7370 && sic < 7380) || sic === 3661 || sic === 3663) return 'Technology'
  if (sic >= 2900 && sic < 3000) return 'Energy'
  if (sic >= 2000 && sic < 2200) return 'Consumer Defensive'
  if (sic >= 2200 && sic < 4000) return sic >= 3710 && sic < 3720 ? 'Consumer Cyclical' : 'Industrials'
  if (sic >= 4000 && sic < 4800) return 'Industrials'
  if (sic >= 4800 && sic < 4900) return 'Communication Services'
  if (sic >= 4900 && sic < 5000) return 'Utilities'
  if (sic >= 5000 && sic < 5200) return 'Industrials'
  if (sic >= 5200 && sic < 6000) return sic >= 5400 && sic < 5500 ? 'Consumer Defensive' : 'Consumer Cyclical'
  if (sic >= 6000 && sic < 6500) return 'Financial Services'
  if (sic >= 6500 && sic < 6800) return 'Real Estate'
  if (sic >= 6800 && sic < 7000) return 'Financial Services'
  if (sic >= 7000 && sic < 9000) return 'Consumer Cyclical'
  return '—'
}
