import { describe, expect, it } from 'vitest'
import { annualFromFacts, adjustForSplits, fiscalYearEnds, sectorFromSic, sharesOutstanding, type CompanyFacts, type XbrlFact } from '@/lib/providers/sec-edgar/xbrl'
import type { AnnualFinancials } from '@/lib/domain/types'

/**
 * Synthetic fixture in the documented SEC company-facts shape
 * (facts → taxonomy → concept → units → [ {start,end,val,fy,fp,form,filed,accn} ]).
 * Values are made up; the tests check parsing rules, not real figures.
 */
const f = (start: string | undefined, end: string, val: number, form: string, filed: string, accn: string, fy: number, fp = 'FY'): XbrlFact => ({ start, end, val, form, filed, accn, fy, fp })
const A = 'acc-2023', B = 'acc-2024', Q = 'acc-q1'
const fixture: CompanyFacts = {
  cik: 1,
  entityName: 'Example Corp',
  facts: {
    dei: { EntityCommonStockSharesOutstanding: { units: { shares: [f(undefined, '2024-10-15', 15.2e9, '10-K', '2024-11-01', B, 2024)] } } },
    'us-gaap': {
      // Concept changed between years: old name in FY2023, new name in FY2024.
      SalesRevenueNet: { units: { USD: [f('2022-10-01', '2023-09-30', 100, '10-K', '2023-11-03', A, 2023)] } },
      RevenueFromContractWithCustomerExcludingAssessedTax: {
        units: {
          USD: [
            f('2023-10-01', '2024-09-30', 120, '10-K', '2024-11-01', B, 2024),
            f('2022-10-01', '2023-09-30', 105, '10-K', '2024-11-01', B, 2024), // restated comparative, filed later → wins
            f('2024-07-01', '2024-09-30', 35, '10-K', '2024-11-01', B, 2024), // Q4-only duration inside a 10-K → ignored
            f('2024-10-01', '2024-12-31', 40, '10-Q', '2025-02-01', Q, 2025, 'Q1'), // quarterly → ignored
          ],
        },
      },
      NetIncomeLoss: { units: { USD: [f('2022-10-01', '2023-09-30', 20, '10-K', '2023-11-03', A, 2023), f('2023-10-01', '2024-09-30', 25, '10-K', '2024-11-01', B, 2024)] } },
      Assets: { units: { USD: [f(undefined, '2023-09-30', 300, '10-K', '2023-11-03', A, 2023), f(undefined, '2024-09-30', 320, '10-K', '2024-11-01', B, 2024)] } },
      StockholdersEquity: { units: { USD: [f(undefined, '2023-09-30', 60, '10-K', '2023-11-03', A, 2023), f(undefined, '2024-09-30', 70, '10-K', '2024-11-01', B, 2024)] } },
      LongTermDebtNoncurrent: { units: { USD: [f(undefined, '2024-09-30', 80, '10-K', '2024-11-01', B, 2024)] } },
      LongTermDebtCurrent: { units: { USD: [f(undefined, '2024-09-30', 10, '10-K', '2024-11-01', B, 2024)] } },
      CommercialPaper: { units: { USD: [f(undefined, '2024-09-30', 5, '10-K', '2024-11-01', B, 2024)] } },
      NetCashProvidedByUsedInOperatingActivities: { units: { USD: [f('2023-10-01', '2024-09-30', 40, '10-K', '2024-11-01', B, 2024)] } },
      PaymentsToAcquirePropertyPlantAndEquipment: { units: { USD: [f('2023-10-01', '2024-09-30', 6, '10-K', '2024-11-01', B, 2024)] } },
      OperatingIncomeLoss: { units: { USD: [f('2023-10-01', '2024-09-30', 30, '10-K', '2024-11-01', B, 2024)] } },
      DepreciationDepletionAndAmortization: { units: { USD: [f('2023-10-01', '2024-09-30', 4, '10-K', '2024-11-01', B, 2024)] } },
      EarningsPerShareDiluted: { units: { 'USD/shares': [f('2022-10-01', '2023-09-30', 8, '10-K', '2023-11-03', A, 2023), f('2023-10-01', '2024-09-30', 2.4, '10-K', '2024-11-01', B, 2024)] } },
      WeightedAverageNumberOfDilutedSharesOutstanding: { units: { shares: [f('2022-10-01', '2023-09-30', 4e9, '10-K', '2023-11-03', A, 2023), f('2023-10-01', '2024-09-30', 15.9e9, '10-K', '2024-11-01', B, 2024)] } },
    },
  },
}

describe('SEC XBRL parsing', () => {
  const rows = annualFromFacts(fixture)
  it('identifies fiscal years from the period each 10-K covers', () => {
    expect([...fiscalYearEnds(fixture).entries()]).toEqual([
      ['2023-09-30', 2023],
      ['2024-09-30', 2024],
    ])
    expect(rows.map((r) => r.fiscalYear)).toEqual([2023, 2024])
  })
  it('uses full-year annual durations only and the latest restatement', () => {
    expect(rows[1].revenue).toBe(120)
    expect(rows[0].revenue).toBe(105) // restated value from the later filing, via the new concept name
  })
  it('reads instants, sums debt components, derives FCF and EBITDA', () => {
    expect(rows[1].totalAssets).toBe(320)
    expect(rows[1].shortTermDebt).toBe(15)
    expect(rows[1].totalDebt).toBe(95)
    expect(rows[1].freeCashFlow).toBe(34)
    expect(rows[1].ebitda).toBe(34)
  })
  it('leaves unreported items null instead of guessing', () => {
    expect(rows[0].operatingCashFlow).toBeNull()
    expect(rows[1].inventory).toBeNull()
    expect(rows[0].totalDebt).toBeNull()
  })
  it('restates pre-split per-share figures onto the current share basis', () => {
    expect(rows[0].sharesDiluted).toBeCloseTo(16e9)
    expect(rows[0].epsDiluted).toBeCloseTo(2)
    expect(rows[1].epsDiluted).toBe(2.4)
  })
  it('does not treat normal buyback drift as a split', () => {
    const base = { sharesDiluted: 100, epsDiluted: 1, dividendPerShare: 0.5 } as AnnualFinancials
    const r = adjustForSplits([{ ...base, fiscalYear: 1 }, { ...base, fiscalYear: 2, sharesDiluted: 96 }])
    expect(r.splits).toEqual([])
  })
  it('reads cover-page shares and maps SIC sectors', () => {
    expect(sharesOutstanding(fixture)).toBe(15.2e9)
    expect(sectorFromSic(3571)).toBe('Technology')
    expect(sectorFromSic(2834)).toBe('Healthcare')
    expect(sectorFromSic(6021)).toBe('Financial Services')
  })
})
