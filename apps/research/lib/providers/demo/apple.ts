/**
 * DEMO DATASET — Apple Inc. (AAPL)
 *
 * These figures are ILLUSTRATIVE. They approximate the shape of Apple's
 * publicly reported annual results so the analysis engine has something
 * realistic to work on, but they have NOT been verified against the filings
 * and must never be shown as real data. Every figure carries the `demo`
 * source tier, and the UI badges it as DEMO DATA.
 *
 * Connect a live provider (see lib/providers) to replace this with sourced data.
 */
import type {
  AnnualFinancials,
  AnalystEstimates,
  EarningsQuarter,
  QualitativeInputs,
  SegmentBreakdown,
  SourceRef,
} from '@/lib/domain/types'

export const DEMO_UPDATED = '2026-09-30'

export const APPLE_SOURCES: Record<string, SourceRef> = {
  'demo-fin': {
    id: 'demo-fin',
    name: 'Demo dataset — illustrative annual financials (not verified against Apple 10-K filings)',
    tier: 'demo',
    period: 'FY2015–FY2025 (fiscal years end late September)',
    updated: DEMO_UPDATED,
    note: 'Replace by connecting SEC EDGAR / a financial data provider.',
  },
  'demo-quote': {
    id: 'demo-quote',
    name: 'Demo quote — placeholder price, not a market quote',
    tier: 'demo',
    updated: DEMO_UPDATED,
  },
  'demo-prices': {
    id: 'demo-prices',
    name: 'Synthetic price series generated in code (anchored to demo fiscal-year prices) — not actual AAPL prices',
    tier: 'demo',
    updated: DEMO_UPDATED,
  },
  'demo-seg': {
    id: 'demo-seg',
    name: 'Demo segment & geographic split (illustrative)',
    tier: 'demo',
    period: 'FY2025',
    updated: DEMO_UPDATED,
  },
  'demo-est': {
    id: 'demo-est',
    name: 'Demo analyst consensus (illustrative third-party estimates)',
    tier: 'demo',
    updated: DEMO_UPDATED,
  },
  'demo-earn': {
    id: 'demo-earn',
    name: 'Demo quarterly results vs. estimates (illustrative)',
    tier: 'demo',
    updated: DEMO_UPDATED,
  },
  'demo-qual': {
    id: 'demo-qual',
    name: 'Demo editorial assessment (structured qualitative inputs with evidence notes)',
    tier: 'demo',
    updated: DEMO_UPDATED,
    note: 'Qualitative ratings are analyst inputs to the model, not AI output.',
  },
  'demo-peers': {
    id: 'demo-peers',
    name: 'Demo peer snapshot metrics (illustrative)',
    tier: 'demo',
    updated: DEMO_UPDATED,
  },
  'demo-industry': {
    id: 'demo-industry',
    name: 'Demo industry medians — Technology hardware & platforms (illustrative)',
    tier: 'demo',
    updated: DEMO_UPDATED,
  },
  'sec-edgar': {
    id: 'sec-edgar',
    name: 'SEC EDGAR filing index',
    tier: 'filing',
    url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000320193&owner=include&count=40',
    updated: DEMO_UPDATED,
  },
}

const B = 1e9
// prettier-ignore
// fy, revenue, cogs, gross, R&D, SG&A, opInc, interest, pretax, tax, netInc, epsDil, sharesDil(B), D&A,
// cash, STinv, LTinv, receivables, inventory, curAssets, netPPE, goodwill, intangibles, totAssets,
// curLiab, totLiab, STdebt, LTdebt, equity, OCF, capex, SBC, dividends, buybacks, acquisitions, DPS, FY-end price
type Row = (number | null)[]
// prettier-ignore
const ROWS: Row[] = [
  [2015, 233.7, 140.1, 93.6, 8.1, 14.3, 71.2, 0.7, 72.5, 19.1, 53.4, 2.31, 23.17, 11.3, 21.1, 20.5, 164.1, 16.8, 2.3, 89.4, 22.5, 5.1, 3.9, 290.5, 80.6, 171.1, 11.0, 53.5, 119.4, 81.3, 11.2, 3.6, 11.6, 36.0, 0.3, 0.495, 27.6],
  [2016, 215.6, 131.4, 84.3, 10.0, 14.2, 60.0, 1.5, 61.4, 15.7, 45.7, 2.08, 22.00, 10.5, 20.5, 46.7, 170.4, 15.8, 2.1, 106.9, 27.0, 5.4, 3.2, 321.7, 79.0, 193.4, 11.6, 75.4, 128.2, 65.8, 12.7, 4.2, 12.2, 29.7, 0.3, 0.545, 28.3],
  [2017, 229.2, 141.0, 88.2, 11.6, 15.3, 61.3, 2.3, 64.1, 15.7, 48.4, 2.30, 21.01, 10.2, 20.3, 53.9, 194.7, 17.9, 4.9, 128.6, 33.8, 5.7, 2.3, 375.3, 100.8, 241.3, 18.5, 97.2, 134.0, 63.6, 12.5, 4.8, 12.8, 32.9, 0.3, 0.60, 38.5],
  [2018, 265.6, 163.8, 101.8, 14.2, 16.7, 70.9, 3.2, 72.9, 13.4, 59.5, 2.98, 19.82, 10.9, 25.9, 40.4, 170.8, 23.2, 4.0, 131.3, 41.3, null, null, 365.7, 116.9, 258.6, 20.7, 93.7, 107.1, 77.4, 13.3, 5.3, 13.7, 72.7, 0.7, 0.68, 56.4],
  [2019, 260.2, 161.8, 98.4, 16.2, 18.2, 63.9, 3.6, 65.7, 10.5, 55.3, 2.97, 18.60, 12.5, 48.8, 51.7, 105.3, 22.9, 4.1, 162.8, 37.4, null, null, 338.5, 105.7, 248.0, 16.2, 91.8, 90.5, 69.4, 10.5, 6.1, 14.1, 66.9, 0.6, 0.75, 56.1],
  [2020, 274.5, 169.6, 104.9, 18.8, 19.9, 66.3, 2.9, 67.1, 9.7, 57.4, 3.28, 17.53, 11.1, 38.0, 52.9, 100.9, 16.1, 4.1, 143.7, 36.8, null, null, 323.9, 105.4, 258.5, 13.8, 98.7, 65.3, 80.7, 7.3, 6.8, 14.1, 72.4, 1.5, 0.795, 115.8],
  [2021, 365.8, 213.0, 152.8, 21.9, 22.0, 108.9, 2.6, 109.2, 14.5, 94.7, 5.61, 16.86, 11.3, 34.9, 27.7, 127.9, 26.3, 6.6, 134.8, 39.4, null, null, 351.0, 125.5, 287.9, 15.6, 109.1, 63.1, 104.0, 11.1, 7.9, 14.5, 86.0, 0.0, 0.85, 141.5],
  [2022, 394.3, 223.5, 170.8, 26.3, 25.1, 119.4, 2.9, 119.1, 19.3, 99.8, 6.11, 16.33, 11.1, 23.6, 24.7, 120.8, 28.2, 4.9, 135.4, 42.1, null, null, 352.8, 154.0, 302.1, 21.1, 98.9, 50.7, 122.2, 10.7, 9.0, 14.8, 89.4, 0.3, 0.90, 138.2],
  [2023, 383.3, 214.1, 169.1, 29.9, 24.9, 114.3, 3.9, 113.7, 16.7, 97.0, 6.13, 15.81, 11.5, 30.0, 31.6, 100.5, 29.5, 6.3, 143.6, 43.7, null, null, 352.6, 145.3, 290.4, 15.8, 95.3, 62.1, 110.5, 11.0, 10.8, 15.0, 77.6, 0.0, 0.94, 171.2],
  [2024, 391.0, 210.4, 180.7, 31.4, 26.1, 123.2, null, 123.5, 29.7, 93.7, 6.08, 15.41, 11.4, 29.9, 35.2, 91.5, 33.4, 7.3, 153.0, 45.7, null, null, 365.0, 176.4, 308.0, 22.5, 85.8, 57.0, 118.3, 9.4, 11.7, 15.2, 95.0, 0.0, 0.98, 233.0],
  [2025, 416.2, 221.0, 195.2, 34.6, 27.6, 133.1, null, 132.7, 20.7, 112.0, 7.46, 15.00, 11.7, 35.9, 18.8, 77.7, 39.8, 5.7, 148.0, 49.8, null, null, 359.2, 165.6, 285.5, 20.3, 78.3, 73.7, 111.5, 12.7, 12.9, 15.4, 90.7, 0.0, 1.02, 254.6],
]

const money = (v: number | null) => (v === null ? null : v * B)

export const APPLE_ANNUAL: AnnualFinancials[] = ROWS.map((r) => {
  const [fy, rev, cogs, gp, rnd, sga, op, int, pretax, tax, ni, eps, sh, da, cash, sti, lti, recv, inv, ca, ppe, gw, intang, ta, cl, tl, std, ltd, eq, ocf, capex, sbc, div, bb, acq, dps, px] = r
  return {
    fiscalYear: fy as number,
    periodEnd: `${fy}-09-30`,
    sourceId: 'demo-fin',
    revenue: money(rev),
    costOfRevenue: money(cogs),
    grossProfit: money(gp),
    researchAndDevelopment: money(rnd),
    sellingGeneralAdmin: money(sga),
    operatingIncome: money(op),
    interestExpense: money(int),
    pretaxIncome: money(pretax),
    incomeTax: money(tax),
    netIncome: money(ni),
    epsDiluted: eps,
    sharesDiluted: money(sh),
    ebitda: op !== null && da !== null ? money(op + da) : null,
    depreciation: money(da),
    cash: money(cash),
    shortTermInvestments: money(sti),
    longTermInvestments: money(lti),
    receivables: money(recv),
    inventory: money(inv),
    currentAssets: money(ca),
    netPPE: money(ppe),
    goodwill: money(gw),
    intangibles: money(intang),
    totalAssets: money(ta),
    currentLiabilities: money(cl),
    totalLiabilities: money(tl),
    shortTermDebt: money(std),
    longTermDebt: money(ltd),
    totalDebt: std !== null && ltd !== null ? money(std + ltd) : null,
    equity: money(eq),
    operatingCashFlow: money(ocf),
    capex: money(capex),
    freeCashFlow: ocf !== null && capex !== null ? money(ocf - capex) : null,
    stockBasedCompensation: money(sbc),
    dividendsPaid: money(div),
    buybacks: money(bb),
    acquisitions: money(acq),
    dividendPerShare: dps,
    fiscalYearEndPrice: px,
  }
})

export const APPLE_SEGMENTS: SegmentBreakdown = {
  fiscalYear: 2025,
  sourceId: 'demo-seg',
  byProduct: [
    { name: 'iPhone', value: 209.6 * B },
    { name: 'Services', value: 109.2 * B },
    { name: 'Wearables, Home & Accessories', value: 35.7 * B },
    { name: 'Mac', value: 33.7 * B },
    { name: 'iPad', value: 28.0 * B },
  ],
  byGeography: [
    { name: 'Americas', value: 178.4 * B },
    { name: 'Europe', value: 111.0 * B },
    { name: 'Greater China', value: 64.4 * B },
    { name: 'Rest of Asia Pacific', value: 33.7 * B },
    { name: 'Japan', value: 28.7 * B },
  ],
}

export const APPLE_ESTIMATES: AnalystEstimates = {
  sourceId: 'demo-est',
  analystCount: 45,
  targetLow: 190,
  targetMedian: 280,
  targetMean: 275,
  targetHigh: 330,
  revenueNextFY: 445 * B,
  epsNextFY: 8.2,
  epsNextFY2: 8.9,
  longTermEpsGrowth: 9,
  asOf: DEMO_UPDATED,
}

// prettier-ignore
export const APPLE_EARNINGS: EarningsQuarter[] = [
  ['Q4 FY2023', '2023-11-02', 1.46, 1.39, 89.5, 89.3],
  ['Q1 FY2024', '2024-02-01', 2.18, 2.10, 119.6, 117.9],
  ['Q2 FY2024', '2024-05-02', 1.53, 1.50, 90.8, 90.0],
  ['Q3 FY2024', '2024-08-01', 1.40, 1.35, 85.8, 84.4],
  ['Q4 FY2024', '2024-10-31', 1.64, 1.60, 94.9, 94.4],
  ['Q1 FY2025', '2025-01-30', 2.40, 2.35, 124.3, 124.1],
  ['Q2 FY2025', '2025-05-01', 1.65, 1.62, 95.4, 94.5],
  ['Q3 FY2025', '2025-07-31', 1.57, 1.43, 94.0, 89.3],
  ['Q4 FY2025', '2025-10-30', 1.85, 1.77, 102.5, 102.2],
  ['Q1 FY2026', '2026-01-29', 2.84, 2.67, 143.8, 138.4],
  ['Q2 FY2026', '2026-04-30', 1.90, 1.85, 108.0, 106.5],
  ['Q3 FY2026', '2026-07-30', 1.80, 1.80, 101.0, 100.8],
].map(([period, reportDate, ea, ee, ra, re]) => ({
  period: period as string,
  reportDate: reportDate as string,
  epsActual: ea as number,
  epsEstimate: ee as number,
  revenueActual: (ra as number) * B,
  revenueEstimate: (re as number) * B,
}))

export const APPLE_QUALITATIVE: QualitativeInputs = {
  sourceId: 'demo-qual',
  businessModel: [
    'Designs, markets and sells consumer hardware — iPhone, Mac, iPad and wearables — manufactured largely by contract partners.',
    'Monetises an installed base of active devices through Services: App Store commissions, iCloud, AppleCare, Apple Music/TV+, advertising, payments and licensing.',
    'Owns the operating systems, silicon design and distribution (retail + online), which ties hardware and services into a single ecosystem.',
  ],
  revenueStreams: [
    'Hardware is sold once per upgrade cycle and is the largest revenue line; its gross margin is structurally lower than Services.',
    'Services revenue is recurring and higher-margin; its growth depends on the size and engagement of the installed base.',
    'Licensing arrangements (for example default search placement) are part of Services and are exposed to regulatory review.',
  ],
  moat: [
    { source: 'brand', strength: 3, evidence: 'Sustained premium pricing versus competing handsets while maintaining unit share; demo gross margin ~47%.' },
    { source: 'switching_costs', strength: 3, evidence: 'Purchases, data, device pairing and family sharing are tied to the Apple ID, raising the practical cost of leaving.' },
    { source: 'ecosystem', strength: 3, evidence: 'Hardware, OS, silicon and services are designed together; each additional device increases the value of the others.' },
    { source: 'network_effects', strength: 2, evidence: 'Two-sided App Store (developers ↔ users) and messaging features create moderate network effects.' },
    { source: 'scale', strength: 3, evidence: 'Very large purchasing volumes give priority access to leading-edge components and manufacturing capacity.' },
    { source: 'intellectual_property', strength: 2, evidence: 'Large patent portfolio and in-house chip design; IP alone is not decisive in consumer electronics.' },
    { source: 'distribution', strength: 2, evidence: 'Own retail and online channels plus carrier partnerships worldwide.' },
    { source: 'cost_advantage', strength: 1, evidence: 'Scale lowers unit costs but Apple competes on premium positioning, not lowest cost.' },
    { source: 'data', strength: 1, evidence: 'Privacy positioning limits data monetisation relative to ad-driven peers.' },
    { source: 'regulatory', strength: 0, evidence: 'No regulatory protection; regulation is a headwind rather than a moat.' },
  ],
  risks: [
    { key: 'regulation', level: 3, evidence: 'App Store rules and default-search payments face antitrust scrutiny in the US and EU (e.g. EU Digital Markets Act).' },
    { key: 'geopolitical', level: 3, evidence: 'Assembly remains concentrated in Asia and Greater China is a material sales region (~15% of demo revenue).' },
    { key: 'supplier_concentration', level: 3, evidence: 'Reliance on a small number of contract manufacturers and a single leading-edge foundry.' },
    { key: 'valuation', level: 3, evidence: 'Multiples above the company’s own 10-year average and industry median (see Valuation).' },
    { key: 'customer_concentration', level: 2, evidence: 'No single dominant customer, but iPhone is ~50% of revenue — product concentration.' },
    { key: 'competition', level: 2, evidence: 'Intense competition in smartphones, PCs and services; Android OEMs compete aggressively on price.' },
    { key: 'disruption', level: 2, evidence: 'Shifts in computing interfaces (e.g. AI assistants, new form factors) could change platform economics.' },
    { key: 'litigation', level: 2, evidence: 'Ongoing antitrust and patent litigation is disclosed in annual filings.' },
    { key: 'currency', level: 2, evidence: 'Majority of revenue is generated outside the United States.' },
    { key: 'economic_slowdown', level: 2, evidence: 'Upgrade cycles can lengthen when consumer spending weakens.' },
    { key: 'cyclicality', level: 2, evidence: 'Hardware demand follows product cycles; Services is steadier.' },
    { key: 'debt', level: 1, evidence: 'Debt is modest relative to EBITDA and cash generation.' },
    { key: 'key_person', level: 1, evidence: 'Deep management bench; no single-person dependency evident from disclosures.' },
    { key: 'commodity', level: 1, evidence: 'Component costs matter (memory, displays) but are partly passed through.' },
    { key: 'interest_rates', level: 1, evidence: 'Low financial leverage; rate sensitivity is mainly through valuation multiples.' },
    { key: 'dilution', level: 1, evidence: 'Share count has fallen every year in the dataset due to buybacks.' },
  ],
  cyclicality: 'moderately_cyclical',
  cyclicalityReason:
    'Hardware demand depends on consumer upgrade cycles and discretionary spending, while the Services base provides recurring revenue that dampens swings. Revenue fell in 2 of the 10 demo years.',
  industry: {
    overview:
      'Consumer technology hardware and platform services: smartphones, personal computers, tablets, wearables and the digital services built on top of them.',
    trends: [
      'Smartphone unit growth is mature; value growth comes from pricing, mix and services attached to the installed base.',
      'On-device and cloud AI features are becoming a competitive axis for operating systems and silicon.',
      'Regulators are pressuring app-store economics, default-placement deals and interoperability.',
      'Supply chains are diversifying geographically (India, Vietnam) to reduce concentration.',
    ],
    barriers:
      'High: operating-system scale, developer ecosystems, silicon design capability, global distribution and brand take many years and large capital to replicate.',
    regulation:
      'Rising. Digital-market rules in the EU, antitrust cases in the US and app-store legislation in several countries target platform fees and defaults.',
    concentration:
      'Concentrated at the premium end: a few platform owners capture most industry profit even where unit share is fragmented.',
    opportunities: [
      'Growing the paid-subscription and services base on existing devices',
      'New device categories and health features',
      'Emerging-market expansion where premium share is still low',
      'AI features that drive upgrade cycles',
    ],
    threats: [
      'Regulatory changes to app-store commissions and default-search payments',
      'Geopolitical disruption to manufacturing or to sales in Greater China',
      'Platform shift that weakens the smartphone as the primary device',
      'Price competition in hardware from Android manufacturers',
    ],
  },
  macroSensitivities: [
    { factor: 'Consumer spending', relevance: 'high', explanation: 'Premium devices are discretionary; weaker real incomes can lengthen upgrade cycles.' },
    { factor: 'Currency (USD strength)', relevance: 'high', explanation: 'Most revenue is earned outside the US; a stronger dollar reduces reported revenue.' },
    { factor: 'Interest rates', relevance: 'medium', explanation: 'Affect the valuation multiple more than operations given low net leverage.' },
    { factor: 'Inflation / component costs', relevance: 'medium', explanation: 'Memory and component prices influence hardware gross margin.' },
    { factor: 'GDP growth (China, US, Europe)', relevance: 'medium', explanation: 'Regional demand follows broad economic conditions.' },
  ],
  geographicNotes: {
    manufacturing: 'Final assembly concentrated in Asia (predominantly China), with capacity being added in India and Vietnam.',
    suppliers: 'Leading-edge processors depend on a single foundry partner; many single-source components are disclosed as a risk in filings.',
    currency: 'Revenue in euros, yuan, yen and other currencies; hedging reduces but does not remove FX exposure.',
    political: 'US–China trade relations affect both the supply chain and Greater China demand.',
  },
  concentrationNotes: [
    'Product concentration: iPhone accounts for roughly half of demo revenue.',
    'Platform concentration: Services revenue relies on App Store economics that are under regulatory review.',
    'Supplier concentration: key components and assembly rely on a small number of partners.',
    'No individual customer is disclosed as a large share of revenue (carriers and distributors are diversified).',
  ],
  marketOpportunity: 2,
  businessSimplicity: 3,
  outlook: [
    {
      horizon: '1Y',
      statements: [
        { kind: 'fact', text: 'The demo dataset shows FY2025 revenue growth of ~6% after two flat years.' },
        { kind: 'expectation', text: 'Demo analyst consensus expects next-year revenue of ~$445B (third-party estimate).' },
        { kind: 'uncertainty', text: 'Regulatory outcomes on App Store fees and search agreements could change Services growth.' },
      ],
    },
    {
      horizon: '3Y',
      statements: [
        { kind: 'assumption', text: 'Base scenario assumes mid-single-digit revenue growth with Services outgrowing hardware.' },
        { kind: 'scenario', text: 'Gross margin could drift upward if Services keeps growing as a share of revenue.' },
        { kind: 'uncertainty', text: 'Whether AI features trigger an above-normal upgrade cycle is not knowable today.' },
      ],
    },
    {
      horizon: '5Y',
      statements: [
        { kind: 'assumption', text: 'Continued net share reduction of ~2–3% per year if buybacks continue at recent pace.' },
        { kind: 'scenario', text: 'Supply-chain diversification could reduce geopolitical concentration risk.' },
        { kind: 'uncertainty', text: 'Competitive position in new computing interfaces is unproven.' },
      ],
    },
    {
      horizon: '10Y',
      statements: [
        { kind: 'scenario', text: 'Durability of the ecosystem (switching costs, installed base) is the central long-term question.' },
        { kind: 'uncertainty', text: 'Ten-year outcomes depend on technology shifts and regulation that cannot be forecast reliably.' },
      ],
    },
  ],
  monitor: [
    'Services growth rate and App Store regulatory decisions',
    'Gross margin trend (product mix and component costs)',
    'Revenue from Greater China and supply-chain diversification progress',
    'Buyback pace relative to free cash flow',
    'Valuation multiple versus the company’s own history',
  ],
}
