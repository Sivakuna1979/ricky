import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * Exercises the live-data path end to end with SEC endpoints mocked (the CI
 * sandbox has no network). Response shapes follow SEC's published formats.
 */
const facts = (() => {
  const u = (rows: [string | undefined, string, number, string][], unit = 'USD') => ({ units: { [unit]: rows.map(([start, end, val, accn]) => ({ start, end, val, accn, form: '10-K', fp: 'FY', fy: Number(accn), filed: `${accn}-11-01` })) } })
  const years = ['2020', '2021', '2022', '2023', '2024']
  const dur = (vals: number[]) => u(years.map((y, i) => [`${Number(y) - 1}-07-01`, `${y}-06-30`, vals[i], y]))
  const inst = (vals: number[]) => u(years.map((y, i) => [undefined, `${y}-06-30`, vals[i], y]))
  return {
    cik: 789019,
    entityName: 'Example Software Inc',
    facts: {
      dei: { EntityCommonStockSharesOutstanding: { units: { shares: [{ end: '2024-07-20', val: 7.4e9, accn: '2024', form: '10-K', fp: 'FY', fy: 2024, filed: '2024-07-30' }] } } },
      'us-gaap': {
        Revenues: dur([143e9, 168e9, 198e9, 212e9, 245e9]),
        CostOfRevenue: dur([46e9, 52e9, 62e9, 66e9, 74e9]),
        OperatingIncomeLoss: dur([53e9, 70e9, 83e9, 89e9, 109e9]),
        NetIncomeLoss: dur([44e9, 61e9, 72e9, 72e9, 88e9]),
        IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest: dur([53e9, 71e9, 83e9, 89e9, 108e9]),
        IncomeTaxExpenseBenefit: dur([9e9, 10e9, 11e9, 17e9, 20e9]),
        DepreciationDepletionAndAmortization: dur([12e9, 11e9, 14e9, 14e9, 22e9]),
        NetCashProvidedByUsedInOperatingActivities: dur([61e9, 77e9, 89e9, 88e9, 119e9]),
        PaymentsToAcquirePropertyPlantAndEquipment: dur([15e9, 21e9, 24e9, 28e9, 44e9]),
        PaymentsForRepurchaseOfCommonStock: dur([23e9, 27e9, 32e9, 22e9, 17e9]),
        PaymentsOfDividends: dur([15e9, 16e9, 18e9, 20e9, 22e9]),
        ShareBasedCompensation: dur([5e9, 6e9, 7.5e9, 9.6e9, 10.7e9]),
        ResearchAndDevelopmentExpense: dur([19e9, 21e9, 25e9, 27e9, 29e9]),
        EarningsPerShareDiluted: { units: { 'USD/shares': years.map((y, i) => ({ start: `${Number(y) - 1}-07-01`, end: `${y}-06-30`, val: [5.76, 8.05, 9.65, 9.68, 11.8][i], accn: y, form: '10-K', fp: 'FY', fy: Number(y), filed: `${y}-11-01` })) } },
        WeightedAverageNumberOfDilutedSharesOutstanding: { units: { shares: years.map((y, i) => ({ start: `${Number(y) - 1}-07-01`, end: `${y}-06-30`, val: [7.68e9, 7.6e9, 7.54e9, 7.47e9, 7.47e9][i], accn: y, form: '10-K', fp: 'FY', fy: Number(y), filed: `${y}-11-01` })) } },
        Assets: inst([301e9, 333e9, 364e9, 411e9, 512e9]),
        AssetsCurrent: inst([181e9, 184e9, 169e9, 184e9, 159e9]),
        LiabilitiesCurrent: inst([72e9, 88e9, 95e9, 104e9, 125e9]),
        Liabilities: inst([183e9, 191e9, 198e9, 205e9, 244e9]),
        StockholdersEquity: inst([118e9, 142e9, 166e9, 206e9, 268e9]),
        CashAndCashEquivalentsAtCarryingValue: inst([13e9, 14e9, 13e9, 34e9, 18e9]),
        ShortTermInvestments: inst([123e9, 116e9, 90e9, 76e9, 57e9]),
        LongTermDebtNoncurrent: inst([59e9, 50e9, 47e9, 42e9, 42e9]),
        LongTermDebtCurrent: inst([3.7e9, 8e9, 2.7e9, 5.2e9, 2.2e9]),
      },
    },
  }
})()

const routes: Record<string, unknown> = {
  'https://www.sec.gov/files/company_tickers_exchange.json': { fields: ['cik', 'name', 'ticker', 'exchange'], data: [[789019, 'EXAMPLE SOFTWARE INC', 'EXSW', 'Nasdaq']] },
  'https://data.sec.gov/submissions/CIK0000789019.json': {
    name: 'EXAMPLE SOFTWARE INC',
    sic: '7372',
    sicDescription: 'Services-Prepackaged Software',
    fiscalYearEnd: '0630',
    addresses: { business: { stateOrCountryDescription: 'WA' } },
    filings: { recent: { form: ['10-K', '4', '8-K'], filingDate: ['2024-07-30', '2024-08-01', '2024-09-01'], accessionNumber: ['0000950170-24-087843', '0001', '0002'], primaryDocument: ['msft-10k.htm', 'x.xml', 'y.htm'], primaryDocDescription: ['10-K', '', ''] } },
  },
  'https://data.sec.gov/api/xbrl/companyfacts/CIK0000789019.json': facts,
}

beforeAll(() => {
  process.env.SEC_USER_AGENT = 'Evidentia tests test@example.com'
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    expect((init?.headers as Record<string, string>)['User-Agent']).toContain('@')
    const body = routes[url]
    return body ? new Response(JSON.stringify(body), { status: 200 }) : new Response('not found', { status: 404 })
  })
})
afterAll(() => {
  vi.unstubAllGlobals()
  delete process.env.SEC_USER_AGENT
})

describe('live pipeline (SEC EDGAR, mocked network)', () => {
  it('searches all SEC tickers', async () => {
    const { searchCompanies } = await import('@/lib/data/dataset')
    const r = await searchCompanies('exsw')
    expect(r[0]).toMatchObject({ ticker: 'EXSW', hasFullAnalysis: true })
  })

  it('builds a live, sourced analysis with no price provider — price-based items unavailable, nothing invented', async () => {
    const { getCompanyDataset } = await import('@/lib/data/dataset')
    const { buildAnalysis } = await import('@/lib/analysis/build')
    const ds = (await getCompanyDataset('EXSW'))!
    expect(ds.mode).toBe('live')
    expect(ds.profile).toMatchObject({ name: 'EXAMPLE SOFTWARE INC', sector: 'Technology', fiscalYearEndMonth: 6 })
    expect(ds.annual.map((y) => y.fiscalYear)).toEqual([2020, 2021, 2022, 2023, 2024])
    expect(ds.sources['sec-edgar'].tier).toBe('filing')
    expect(ds.filings[0].url).toContain('/Archives/edgar/data/789019/000095017024087843/msft-10k.htm')
    expect(ds.quote.price).toBeNull()

    const a = buildAnalysis(ds)!
    expect(a.overall.score).not.toBeNull()
    expect(a.fp.latest.roic).toBeGreaterThan(20)
    expect(a.valuation.pe).toBeNull()
    expect(a.indicators.find((i) => i.id === 'val.fcf_yield')!.score).toBeNull()
    expect(a.overall.excluded).toContain('valuation')
    expect(a.dcf).toEqual([])
    expect(a.confidence.components.find((c) => c.key === 'reliability')!.score).toBe(100)
  })

  it('renders the PDF report for a live company', async () => {
    const { getCompanyDataset } = await import('@/lib/data/dataset')
    const { buildAnalysis } = await import('@/lib/analysis/build')
    const { renderReport } = await import('@/lib/report/pdf')
    const pdf = await renderReport(buildAnalysis((await getCompanyDataset('EXSW'))!)!)
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
  })
})
