import type { Metadata } from 'next'
import Link from 'next/link'
import { getCompanyDataset, liveDataEnabled, normaliseTicker } from '@/lib/data/dataset'
import { buildAnalysis } from '@/lib/analysis/build'
import { DEMO_UNIVERSE } from '@/lib/providers/demo'
import { fmtMoney, fmtPct, fmtX } from '@/lib/format'
import { CompanyHeader } from '@/components/company/header'
import { SectionNav } from '@/components/company/section-nav'
import { ScoreExplorer } from '@/components/company/score-explorer'
import { DataQuality, ExecutiveSummary, Overview, Thesis } from '@/components/company/sections-summary'
import { BalanceSheet, CashFlow, Growth, Profitability, Statements } from '@/components/company/sections-fundamentals'
import { Dcf, Performance, Scenarios, Valuation } from '@/components/company/sections-valuation'
import { CompetitorSection, Dividend, Frameworks, Industry, Management, Moat } from '@/components/company/sections-quality'
import { Analysts, Earnings, Filings, News, Risk, Technical } from '@/components/company/sections-market'
import { Checklist, InvestmentPicture, Outlook, Psychology } from '@/components/company/sections-future'
import { Callout } from '@/components/ui/section'
import { DISCLAIMER } from '@/components/layout/site-footer'
import { getViewer } from '@/lib/auth/viewer'
import { hasFeature, type Feature } from '@/lib/plans'
import { LockedCard } from '@/components/ui/locked'
import { Section } from '@/components/ui/section'
import { Chat } from '@/components/assistant/chat'

export const revalidate = 3600

export async function generateMetadata({ params }: { params: { ticker: string } }): Promise<Metadata> {
  const t = normaliseTicker(params.ticker) ?? 'Company'
  return { title: `${t} analysis`, description: `Evidence-based fundamental analysis, valuation and risk for ${t}.` }
}

function NoData({ ticker }: { ticker: string }) {
  const snap = DEMO_UNIVERSE.find((c) => c.ticker === ticker)
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold text-fg">{snap ? `${snap.name} (${ticker})` : ticker}</h1>
      <div className="mt-4">
        <Callout title="Full analysis unavailable">
          {liveDataEnabled()
            ? 'The connected data provider returned no usable annual financial statements for this ticker (it may not file with the SEC, or the provider could not be reached). Nothing has been estimated in their place.'
            : 'No live financial data provider is connected, and the demo dataset only includes a full model for Apple (AAPL). Rather than invent figures, this page shows only what is available.'}
        </Callout>
      </div>
      {snap && (
        <div className="card card-pad mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-fg">Snapshot metrics</h2>
            <span className="chip border-neu/40 bg-neu-soft text-[10px] font-semibold uppercase text-neu">Demo data</span>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ['Market cap', fmtMoney(snap.marketCap)],
              ['Revenue', fmtMoney(snap.revenue)],
              ['Revenue growth', fmtPct(snap.revenueGrowth)],
              ['P/E', fmtX(snap.pe)],
              ['Operating margin', fmtPct(snap.operatingMargin)],
              ['ROIC', fmtPct(snap.roic)],
              ['FCF yield', fmtPct(snap.fcfYield)],
              ['EV/EBITDA', fmtX(snap.evToEbitda)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-fg-3">{k}</dt>
                <dd className="num text-fg">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <div className="mt-6 flex gap-2">
        <Link href="/company/AAPL" className="btn btn-primary">
          Open the Apple demo
        </Link>
        <Link href="/methodology" className="btn">
          How data is sourced
        </Link>
      </div>
    </div>
  )
}

export default async function CompanyPage({ params }: { params: { ticker: string } }) {
  const ticker = normaliseTicker(decodeURIComponent(params.ticker))
  if (!ticker) return <NoData ticker={params.ticker.slice(0, 12).toUpperCase()} />
  const ds = await getCompanyDataset(ticker)
  const a = ds ? buildAnalysis(ds) : null
  if (!a) return <NoData ticker={ticker} />
  const viewer = await getViewer()
  const can = (f: Feature) => hasFeature(viewer.plan, f)
  const gate = (f: Feature, title: string, node: React.ReactNode) => (can(f) ? node : <LockedCard key={title} feature={f} title={title} />)
  const name = a.dataset.profile.name.replace(/ Inc\.?$/, '')

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
      {a.dataset.mode === 'demo' && (
        <div className="mt-4 rounded-lg border border-neu/40 bg-neu-soft px-4 py-2.5 text-sm text-fg-2">
          <strong className="text-neu">DEMO DATA.</strong> No live data provider is connected. Every figure on this page comes from an illustrative dataset and is labelled as such — it is not a verified or current
          record of {a.dataset.profile.name}’s results or share price.
        </div>
      )}
      {a.dataset.mode === 'live' && (
        <div className="mt-4 rounded-lg border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm text-fg-2">
          <strong className="text-accent">Live data.</strong> Sourced from {Object.values(a.dataset.sources).map((s) => s.name.split(' —')[0]).join(', ')}. Hover any source badge for the filing period and update date.
          {a.dataset.quote.price === null && (
            <span className="mt-1 block text-neu">
              No price provider is connected, so valuation, DCF, scenarios and technical sections show “Data unavailable” and are excluded from the score. Set ALPHA_VANTAGE_API_KEY or FMP_API_KEY to add prices.
            </span>
          )}
          {a.dataset.pricesInterval === 'weekly' && <span className="mt-1 block text-fg-3">Price history is weekly, so daily technical indicators (RSI, MACD, moving averages) are not computed.</span>}
        </div>
      )}
      <div className="mt-4">
        <CompanyHeader a={a} canReport={can('reports')} />
      </div>
      <SectionNav />
      <div className="mt-6 space-y-6">
        <ScoreExplorer categories={a.categories} confidence={a.confidence.score} />
        <ExecutiveSummary a={a} />
        <Thesis a={a} />
        <Overview a={a} />
        <Statements a={a} />
        <Growth a={a} />
        <Profitability a={a} />
        <CashFlow a={a} />
        <BalanceSheet a={a} />
        {can('full_analysis') ? (
          <>
            <Valuation a={a} />
            {gate('dcf', 'Interactive DCF', <Dcf a={a} />)}
            <Moat a={a} />
            <Management a={a} />
            <Dividend a={a} />
            {gate('competitors', 'Competitor analysis', <CompetitorSection a={a} />)}
            <Industry a={a} />
            <Risk a={a} />
            {gate('frameworks', 'Investor strategy frameworks', <Frameworks a={a} />)}
            <Technical a={a} />
            <Analysts a={a} />
            <Earnings a={a} />
            <Filings a={a} />
            <News a={a} />
            <Outlook a={a} />
            {gate('dcf', 'Scenario analysis', <Scenarios a={a} />)}
            <Performance a={a} />
          </>
        ) : (
          <LockedCard feature="full_analysis" title="Full fundamental analysis">
            Valuation, DCF, moat, management, competitors, risk, investor frameworks, technicals, earnings, filings, outlook and scenarios are part of Premium.
          </LockedCard>
        )}
        <Section id="ask" kicker="AI research assistant" title={`Ask about ${name}`} description="Answers are grounded in the figures on this page and label facts, expectations, assumptions and uncertainty.">
          <Chat
            compact
            enabled={can('ai')}
            tickers={[a.dataset.profile.ticker]}
            suggestions={[`Explain ${name}’s debt.`, `Why has ${name}’s ROIC changed?`, `Is ${name}’s valuation historically expensive?`, `What are ${name}’s biggest risks?`, `What could ${name}’s business look like in 10 years?`]}
          />
        </Section>
        {can('full_analysis') && <Checklist a={a} />}
        <Psychology />
        <InvestmentPicture a={a} />
        <DataQuality a={a} />
        <p className="rounded-lg border border-ink-700 p-4 text-xs leading-relaxed text-fg-3">{DISCLAIMER}</p>
      </div>
    </div>
  )
}
