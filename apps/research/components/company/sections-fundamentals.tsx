import type { CompanyAnalysis } from '@/lib/analysis/build'
import { currencySymbol, fmtPct, fmtX, fmtMoney } from '@/lib/format'
import { mean } from '@/lib/finance/stats'
import { Section, Stat, Callout } from '@/components/ui/section'
import { SourceTag } from '@/components/ui/source-tag'
import { AnnualChart } from '@/components/charts/annual-chart'
import { IndicatorList, MetricHistoryTable, Pill } from './primitives'
import { FinancialStatements } from './financial-statements'

const pct = (v: number | null) => fmtPct(v)
const x2 = (v: number | null) => fmtX(v, 2)
const cat = (a: CompanyAnalysis, k: string) => a.categories.find((c) => c.key === k)!

function yearsData(a: CompanyAnalysis, pick: (i: number) => Record<string, number | null>) {
  return a.dataset.annual.map((y, i) => ({ label: `FY${String(y.fiscalYear).slice(2)}`, ...pick(i) }))
}

export function Statements({ a }: { a: CompanyAnalysis }) {
  const ds = a.dataset
  return (
    <Section
      id="statements"
      kicker="Financial statements"
      title="Income statement, balance sheet and cash flow"
      description="Up to 10 fiscal years. Switch between raw figures, year-over-year growth and common-size views."
      actions={<SourceTag source={ds.sources[a.fp.latestAnnual.sourceId]} />}
    >
      <FinancialStatements annual={ds.annual} currency={ds.profile.currency} sym={currencySymbol(ds.profile.currency)} demo={ds.mode === 'demo'} />
    </Section>
  )
}

export function Growth({ a }: { a: CompanyAnalysis }) {
  const g = a.fp.growth
  const sym = currencySymbol(a.dataset.profile.currency)
  const c = cat(a, 'growth')
  const trendTone = { accelerating: 'pos', stable: 'accent', slowing: 'neu', declining: 'neg', unknown: 'default' } as const
  const rows: [string, typeof g.revenue][] = [
    ['Revenue', g.revenue],
    ['Diluted EPS', g.eps],
    ['Free cash flow', g.fcf],
    ['Operating income', g.operatingIncome],
    ['Dividend per share', g.dividend],
  ]
  const est = a.dataset.estimates
  return (
    <Section
      id="growth"
      kicker={`Revenue & earnings growth · score ${c.score ?? '—'}/100`}
      title="Is the company growing — and is growth profitable?"
      actions={
        <>
          <Pill tone={trendTone[a.fp.revenueTrend]}>Revenue: {a.fp.revenueTrend}</Pill>
          <Pill tone={trendTone[a.fp.epsTrend]}>EPS: {a.fp.epsTrend}</Pill>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Compound annual growth</th>
                <th className="text-right">1 yr</th>
                <th className="text-right">3 yr</th>
                <th className="text-right">5 yr</th>
                <th className="text-right">10 yr</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, s]) => (
                <tr key={label}>
                  <td className="text-fg">{label}</td>
                  {[s.y1, s.y3, s.y5, s.y10].map((v, i) => (
                    <td key={i} className={`num text-right ${v === null ? '' : v >= 0 ? 'text-fg' : 'text-neg'}`}>
                      {fmtPct(v, 1, true)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label="Consensus revenue, next FY" value={fmtMoney(est?.revenueNextFY ?? null, a.dataset.profile.currency)} sub="Third-party analyst estimate">
              {est && <SourceTag source={a.dataset.sources[est.sourceId]} />}
            </Stat>
            <Stat label="Consensus EPS, next FY" value={est?.epsNextFY ? `${sym}${est.epsNextFY.toFixed(2)}` : 'Data unavailable'} sub={est?.longTermEpsGrowth ? `Long-term EPS growth est. ${est.longTermEpsGrowth}%/yr` : 'Third-party estimate'} />
          </div>
        </div>
        <AnnualChart
          title="Revenue and net income"
          format="money"
          sym={sym}
          data={yearsData(a, (i) => ({ revenue: a.dataset.annual[i].revenue, netIncome: a.dataset.annual[i].netIncome }))}
          series={[
            { key: 'revenue', label: 'Revenue', color: '#3987e5', kind: 'bar' },
            { key: 'netIncome', label: 'Net income', color: '#d95926', kind: 'bar' },
          ]}
        />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AnnualChart
          title="Diluted EPS"
          format="price"
          sym={sym}
          data={yearsData(a, (i) => ({ eps: a.dataset.annual[i].epsDiluted }))}
          series={[{ key: 'eps', label: 'Diluted EPS', color: '#199e70', kind: 'bar' }]}
        />
        <AnnualChart
          title="Year-over-year growth"
          format="pct"
          data={yearsData(a, (i) => ({ rev: a.fp.years[i].revenueGrowth, eps: a.fp.years[i].epsGrowth }))}
          series={[
            { key: 'rev', label: 'Revenue growth', color: '#3987e5', kind: 'line' },
            { key: 'eps', label: 'EPS growth', color: '#d95926', kind: 'line' },
          ]}
        />
      </div>
      <div className="mt-6">
        <IndicatorList a={a} indicators={c.indicators} />
      </div>
    </Section>
  )
}

export function Profitability({ a }: { a: CompanyAnalysis }) {
  const ind = a.dataset.industry
  const peers = a.dataset.peers
  const c = cat(a, 'profitability')
  return (
    <Section id="profitability" kicker={`Profitability quality · score ${c.score ?? '—'}/100`} title="How much of each sale becomes profit — and on how much capital?">
      <MetricHistoryTable
        a={a}
        rows={[
          { label: 'Gross margin', key: 'grossMargin', fmt: pct, industry: ind?.grossMargin, indicatorId: 'prof.gross_margin', glossaryKey: 'grossMargin' },
          { label: 'Operating margin', key: 'operatingMargin', fmt: pct, industry: ind?.operatingMargin, peer: mean(peers.map((p) => p.operatingMargin)), indicatorId: 'prof.operating_margin', glossaryKey: 'operatingMargin' },
          { label: 'Net margin', key: 'netMargin', fmt: pct, industry: ind?.netMargin, peer: mean(peers.map((p) => p.netMargin)), indicatorId: 'prof.net_margin', glossaryKey: 'netMargin' },
          { label: 'FCF margin', key: 'fcfMargin', fmt: pct, indicatorId: 'cf.fcf_margin', glossaryKey: 'fcfMargin' },
          { label: 'ROIC', key: 'roic', fmt: pct, industry: ind?.roic, peer: mean(peers.map((p) => p.roic)), indicatorId: 'prof.roic', glossaryKey: 'roic' },
          { label: 'ROE', key: 'roe', fmt: pct, industry: ind?.roe, peer: mean(peers.map((p) => p.roe)), indicatorId: 'prof.roe', glossaryKey: 'roe' },
          { label: 'ROA', key: 'roa', fmt: pct, indicatorId: 'prof.roa', glossaryKey: 'roa' },
        ]}
      />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AnnualChart
          title="Margins"
          format="pct"
          data={yearsData(a, (i) => ({ gm: a.fp.years[i].grossMargin, om: a.fp.years[i].operatingMargin, nm: a.fp.years[i].netMargin }))}
          series={[
            { key: 'gm', label: 'Gross', color: '#3987e5', kind: 'line' },
            { key: 'om', label: 'Operating', color: '#d95926', kind: 'line' },
            { key: 'nm', label: 'Net', color: '#199e70', kind: 'line' },
          ]}
        />
        <AnnualChart
          title="Return on invested capital"
          format="pct"
          data={yearsData(a, (i) => ({ roic: a.fp.years[i].roic }))}
          series={[{ key: 'roic', label: 'ROIC', color: '#9085e9', kind: 'bar' }]}
        />
      </div>
      <div className="mt-6">
        <IndicatorList a={a} indicators={c.indicators} />
      </div>
    </Section>
  )
}

export function CashFlow({ a }: { a: CompanyAnalysis }) {
  const sym = currencySymbol(a.dataset.profile.currency)
  const c = cat(a, 'cash_flow')
  const flag = a.indicators.find((i) => i.id === 'cf.ni_vs_ocf')
  const L = a.fp.latestAnnual
  return (
    <Section id="cash-flow" kicker={`Cash flow quality · score ${c.score ?? '—'}/100`} title="Are reported earnings backed by cash?">
      {flag?.rating === 'negative' && (
        <div className="mb-5">
          <Callout tone="warn" title="Earnings / cash flow divergence flagged">
            {flag.rationale} ({flag.display})
          </Callout>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Operating cash flow" value={fmtMoney(L.operatingCashFlow)} sub={`FY${L.fiscalYear}`} />
        <Stat label="Free cash flow" value={fmtMoney(L.freeCashFlow)} sub={`${fmtPct(a.fp.latest.fcfMargin)} of revenue`} />
        <Stat label="FCF per share" value={a.fp.latest.fcfPerShare ? `${sym}${a.fp.latest.fcfPerShare.toFixed(2)}` : '—'} />
        <Stat label="Capital expenditure" value={fmtMoney(L.capex)} sub={`${fmtPct(a.fp.latest.capexToRevenue)} of revenue`} />
        <Stat label="Stock-based comp." value={fmtMoney(L.stockBasedCompensation)} sub={`${fmtPct(a.fp.latest.sbcToFcf)} of FCF`} />
        <Stat label="Dividends paid" value={fmtMoney(L.dividendsPaid)} />
        <Stat label="Share buybacks" value={fmtMoney(L.buybacks)} />
        <Stat label="Acquisitions" value={fmtMoney(L.acquisitions)} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AnnualChart
          title="Net income vs operating cash flow vs free cash flow"
          format="money"
          sym={sym}
          data={yearsData(a, (i) => ({ ni: a.dataset.annual[i].netIncome, ocf: a.dataset.annual[i].operatingCashFlow, fcf: a.dataset.annual[i].freeCashFlow }))}
          series={[
            { key: 'ni', label: 'Net income', color: '#d95926', kind: 'bar' },
            { key: 'ocf', label: 'Operating cash flow', color: '#3987e5', kind: 'bar' },
            { key: 'fcf', label: 'Free cash flow', color: '#199e70', kind: 'bar' },
          ]}
        />
        <AnnualChart
          title="Where free cash flow went"
          format="money"
          sym={sym}
          data={yearsData(a, (i) => ({ div: a.dataset.annual[i].dividendsPaid, bb: a.dataset.annual[i].buybacks, capex: a.dataset.annual[i].capex }))}
          series={[
            { key: 'bb', label: 'Buybacks', color: '#3987e5', kind: 'bar' },
            { key: 'div', label: 'Dividends', color: '#d95926', kind: 'bar' },
            { key: 'capex', label: 'Capex', color: '#199e70', kind: 'bar' },
          ]}
        />
      </div>
      <div className="mt-6">
        <IndicatorList a={a} indicators={c.indicators} />
      </div>
    </Section>
  )
}

export function BalanceSheet({ a }: { a: CompanyAnalysis }) {
  const ind = a.dataset.industry
  const c = cat(a, 'financial_strength')
  const sym = currencySymbol(a.dataset.profile.currency)
  const L = a.fp.latestAnnual
  return (
    <Section
      id="balance-sheet"
      kicker={`Balance sheet strength · score ${c.score ?? '—'}/100`}
      title="Is the company financially strong?"
      actions={a.labels.balanceSheet && <Pill tone={(c.score ?? 0) >= 65 ? 'pos' : (c.score ?? 0) >= 50 ? 'neu' : 'neg'}>{a.labels.balanceSheet}</Pill>}
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Cash & ST investments" value={fmtMoney((L.cash ?? 0) + (L.shortTermInvestments ?? 0))} sub={`Plus ${fmtMoney(L.longTermInvestments)} long-term investments`} />
        <Stat label="Total debt" value={fmtMoney(L.totalDebt)} />
        <Stat label="Net debt" value={fmtMoney(a.fp.latest.netDebt)} sub="Debt − cash − ST investments" />
        <Stat label="Shareholders’ equity" value={fmtMoney(L.equity)} />
      </div>
      <div className="mt-6">
        <MetricHistoryTable
          a={a}
          rows={[
            { label: 'Current ratio', key: 'currentRatio', fmt: x2, industry: ind?.currentRatio, indicatorId: 'fs.current_ratio', glossaryKey: 'currentRatio' },
            { label: 'Quick ratio', key: 'quickRatio', fmt: x2, indicatorId: 'fs.quick_ratio', glossaryKey: 'quickRatio' },
            { label: 'Debt / equity', key: 'debtToEquity', fmt: x2, industry: ind?.debtToEquity, indicatorId: 'fs.debt_to_equity', glossaryKey: 'debtToEquity' },
            { label: 'Net debt / EBITDA', key: 'netDebtToEbitda', fmt: x2, indicatorId: 'fs.net_debt_ebitda', glossaryKey: 'netDebtToEbitda' },
            { label: 'Debt / EBITDA', key: 'debtToEbitda', fmt: x2 },
            { label: 'Interest coverage', key: 'interestCoverage', fmt: (v) => fmtX(v), indicatorId: 'fs.interest_coverage', glossaryKey: 'interestCoverage' },
            { label: 'Goodwill & intangibles / assets', key: 'goodwillToAssets', fmt: pct, indicatorId: 'fs.goodwill' },
          ]}
        />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AnnualChart
          title="Debt vs cash & short-term investments"
          format="money"
          sym={sym}
          data={yearsData(a, (i) => ({ debt: a.dataset.annual[i].totalDebt, cash: (a.dataset.annual[i].cash ?? 0) + (a.dataset.annual[i].shortTermInvestments ?? 0) }))}
          series={[
            { key: 'debt', label: 'Total debt', color: '#d95926', kind: 'bar' },
            { key: 'cash', label: 'Cash + ST investments', color: '#3987e5', kind: 'bar' },
          ]}
        />
        <div className="space-y-3 text-sm text-fg-2">
          <h3 className="font-semibold text-fg">Reading this balance sheet</h3>
          <p>
            The category score blends leverage (net debt/EBITDA, FCF/debt), liquidity (current and quick ratios) and balance-sheet quality (goodwill). Debt maturity schedules and pension liabilities require
            filing-level data that this dataset does not include — they are not estimated.
          </p>
          <p className="text-fg-3">Categories: Very Strong ≥ 80 · Strong ≥ 65 · Moderate ≥ 50 · Weak ≥ 35 · High Risk &lt; 35.</p>
        </div>
      </div>
      <div className="mt-6">
        <IndicatorList a={a} indicators={c.indicators} />
      </div>
    </Section>
  )
}
