import type { Subject } from './context'
import { fmtMoney, fmtPct, fmtPrice, fmtX } from '@/lib/format'
import { categoryScore } from '@/lib/scoring/engine'

/**
 * Rules-based research answers used when no LLM is configured (or the model is
 * unavailable). Every sentence is assembled from computed figures, so nothing
 * here can be hallucinated — at the cost of flexibility.
 */
type Intent = 'debt' | 'roic' | 'compare' | 'valuation' | 'risks' | 'future' | 'growth' | 'dividend' | 'moat' | 'score' | 'cash' | 'summary'

export function detectIntent(q: string, n: number): Intent {
  const s = q.toLowerCase()
  if (n > 1 || /\b(compare|versus|vs\.?|against)\b/.test(s)) return 'compare'
  if (/\b(debt|leverage|borrow|balance sheet|liquidity)\b/.test(s)) return 'debt'
  if (/\broic\b|return on (invested )?capital/.test(s)) return 'roic'
  if (/valuation|expensive|cheap|overvalued|undervalued|\bp\/?e\b|multiple|fair value|dcf/.test(s)) return 'valuation'
  if (/risk|could go wrong|threat|downside|bear/.test(s)) return 'risks'
  if (/future|10 years|ten years|long[- ]term|outlook|next decade|5 years|five years/.test(s)) return 'future'
  if (/grow|revenue|sales|eps/.test(s)) return 'growth'
  if (/dividend|payout|yield/.test(s)) return 'dividend'
  if (/moat|competitive advantage|edge/.test(s)) return 'moat'
  if (/cash flow|fcf|free cash/.test(s)) return 'cash'
  if (/score|why \d+|rating/.test(s)) return 'score'
  return 'summary'
}

const demoNote = (sub: Subject) => (sub.analysis?.dataset.mode === 'demo' ? '\n\n_Figures come from the **demo dataset** (illustrative, not verified against filings)._' : '')

export function fallbackAnswer(question: string, subjects: Subject[]): string {
  if (!subjects.length) {
    return 'I could not identify which company you mean. Mention a ticker or name (e.g. “AAPL” or “Apple”), or open a company page and ask from there.\n\nI only answer from data the platform has loaded — I will not guess figures.'
  }
  const intent = detectIntent(question, subjects.length)
  if (intent === 'compare') return compare(subjects)
  const sub = subjects[0]
  const a = sub.analysis
  if (!a) {
    const s = sub.snapshot
    if (!s) return `**${sub.ticker}**: Data unavailable. No dataset is loaded for this ticker, so I can’t answer without guessing.`
    return `**${sub.ticker}** has only snapshot metrics in this deployment (demo data): revenue growth ${fmtPct(s.revenueGrowth)}, operating margin ${fmtPct(s.operatingMargin)}, ROIC ${fmtPct(s.roic)}, P/E ${fmtX(s.pe)}, FCF yield ${fmtPct(s.fcfYield)}. Snapshot score ${s.scores.overall ?? '—'}/100 (headline metrics only).\n\nA full answer needs the complete financial dataset — connect a data provider.`
  }
  const L = a.fp.latest
  const y = a.fp.latestAnnual
  const name = a.dataset.profile.name
  const ind = (id: string) => a.indicators.find((i) => i.id === id)
  const lines: string[] = []

  switch (intent) {
    case 'debt': {
      lines.push(`### ${name}: debt and balance sheet`)
      lines.push(`**[Fact]** Total debt was ${fmtMoney(y.totalDebt)} against ${fmtMoney((y.cash ?? 0) + (y.shortTermInvestments ?? 0))} of cash and short-term investments, so net debt was ${fmtMoney(L.netDebt)} (FY${y.fiscalYear}).`)
      lines.push(`- Net debt / EBITDA: **${fmtX(L.netDebtToEbitda, 2)}** — ${ind('fs.net_debt_ebitda')?.rationale ?? ''}`)
      lines.push(`- Free cash flow / total debt: **${ind('fs.fcf_to_debt')?.display}** — ${ind('fs.fcf_to_debt')?.rationale ?? ''}`)
      lines.push(`- Debt / equity: **${fmtX(L.debtToEquity, 2)}** — ${ind('fs.debt_to_equity')?.rationale ?? ''}`)
      lines.push(`- Current ratio: **${fmtX(L.currentRatio, 2)}** — ${ind('fs.current_ratio')?.rationale ?? ''}`)
      lines.push(`- Interest coverage: **${ind('fs.interest_coverage')?.display}**${L.interestCoverage === null ? ' (interest expense not disclosed separately in this dataset — not estimated).' : ''}`)
      if (y.longTermInvestments) lines.push(`\nNote: the company also holds ${fmtMoney(y.longTermInvestments)} of long-term investments, which the conservative net-debt figure excludes.`)
      lines.push(`\n**Assessment (methodology):** Financial Strength ${categoryScore(a.categories, 'financial_strength')}/100 — *${a.labels.balanceSheet}*.`)
      break
    }
    case 'roic': {
      const ys = a.fp.years
      const first = ys.find((x) => x.roic !== null)
      lines.push(`### ${name}: return on invested capital`)
      lines.push(`**[Fact]** ROIC was **${fmtPct(L.roic)}** in FY${y.fiscalYear}, versus a 5-year average of ${fmtPct(a.fp.avg5.roic ?? null)}${first ? ` and ${fmtPct(first.roic)} in FY${first.fiscalYear}` : ''}.`)
      lines.push(`\nROIC = after-tax operating profit ÷ invested capital (debt + equity − cash). It changes when either side moves:`)
      if (first) {
        const f = a.dataset.annual.find((z) => z.fiscalYear === first.fiscalYear)!
        lines.push(`- **Operating profit** went from ${fmtMoney(f.operatingIncome)} to ${fmtMoney(y.operatingIncome)}.`)
        lines.push(`- **Invested capital** went from ${fmtMoney(first.investedCapital)} to ${fmtMoney(L.investedCapital)}; equity fell from ${fmtMoney(f.equity)} to ${fmtMoney(y.equity)}, largely reflecting ${fmtMoney(a.dataset.annual.reduce((s, z) => s + (z.buybacks ?? 0), 0))} of cumulative buybacks in the dataset.`)
      }
      lines.push(`\n**Interpretation:** much of the rise comes from a *shrinking capital base* as well as higher profits. Very high ROIC here partly reflects a capital-light model with large buybacks — compare the trend and peers rather than reading the level alone.`)
      break
    }
    case 'valuation': {
      lines.push(`### ${name}: is the valuation historically expensive?`)
      lines.push(`**[Fact]** At ${fmtPrice(a.valuation.price)} the stock trades on ${fmtX(a.valuation.pe)} earnings, ${fmtX(a.valuation.evToEbitda)} EV/EBITDA and a ${fmtPct(a.valuation.fcfYield, 2)} FCF yield.`)
      for (const m of a.multiples.filter((m) => ['pe', 'evToEbitda', 'pfcf'].includes(m.key)))
        lines.push(`- ${m.label}: ${fmtX(m.current)} vs 5-yr avg ${fmtX(m.avg5)}, 10-yr avg ${fmtX(m.avg10)}${m.industry !== null ? `, industry ${fmtX(m.industry)}` : ''} → **${m.premiumPct === null ? 'n/a' : `${m.premiumPct >= 0 ? '+' : ''}${m.premiumPct.toFixed(0)}%`}** vs references`)
      const base = a.dcf.find((d) => d.name === 'Base')
      if (base) lines.push(`\n**[Assumption]** Base-case DCF (${base.inputs.fcfGrowth}% FCF growth for 5 yrs, ${base.inputs.wacc}% WACC, ${base.inputs.terminalGrowth}% terminal): **${fmtPrice(base.result.perShare)}** per share.`)
      if (a.impliedGrowth !== null) lines.push(`**[Scenario]** The current price implies ~**${a.impliedGrowth.toFixed(1)}%** annual FCF growth for five years at that discount rate — the key assumption to test.`)
      lines.push(`\n**Methodology verdict:** Valuation ${categoryScore(a.categories, 'valuation')}/100 — *${a.labels.valuation}*. Based on several multiples, not one ratio.`)
      break
    }
    case 'risks': {
      lines.push(`### ${name}: biggest risks`)
      a.topRisks.forEach((r, i) => lines.push(`${i + 1}. **${r.label}** (${r.display}) — ${r.rationale}`))
      lines.push(`\nOverall risk level: **${a.labels.risk}** (risk score ${categoryScore(a.categories, 'risk')}/100, higher = lower risk).`)
      break
    }
    case 'future': {
      lines.push(`### ${name}: what could the business look like?`)
      lines.push('Nobody can know this. Here is what the data supports, clearly separated:')
      for (const o of a.dataset.qualitative?.outlook ?? []) {
        lines.push(`\n**${o.horizon}**`)
        for (const st of o.statements) lines.push(`- **[${st.kind[0].toUpperCase() + st.kind.slice(1)}]** ${st.text}`)
      }
      lines.push('\n**[Scenario] Five-year models (not forecasts):**')
      for (const s of a.scenarios) lines.push(`- ${s.name}: revenue ${fmtMoney(s.revenue)}, EPS $${s.eps.toFixed(2)}, value range $${s.valueLow.toFixed(0)}–$${s.valueHigh.toFixed(0)} (assumes ${s.revenueCagr}% revenue CAGR, ${s.operatingMargin}% op. margin, exit P/E ${s.exitPeLow}–${s.exitPeHigh}×).`)
      lines.push(`\n**[Uncertainty]** Ten-year outcomes depend on technology shifts, competition and regulation that cannot be forecast reliably.`)
      break
    }
    case 'growth': {
      const g = a.fp.growth
      lines.push(`### ${name}: growth`)
      lines.push(`**[Fact]** Revenue grew ${fmtPct(g.revenue.y1, 1, true)} last year; CAGR ${fmtPct(g.revenue.y3, 1, true)} (3 yr), ${fmtPct(g.revenue.y5, 1, true)} (5 yr), ${fmtPct(g.revenue.y10, 1, true)} (10 yr). Trend: **${a.fp.revenueTrend}**.`)
      lines.push(`**[Fact]** EPS CAGR ${fmtPct(g.eps.y5, 1, true)} over 5 years — faster than revenue, helped by a falling share count (${fmtPct(a.dilution.rate5, 1, true)}/yr).`)
      if (a.dataset.estimates) lines.push(`**[Expectation]** Third-party consensus: next-year revenue ${fmtMoney(a.dataset.estimates.revenueNextFY)}, EPS $${a.dataset.estimates.epsNextFY?.toFixed(2)}.`)
      break
    }
    case 'dividend': {
      lines.push(`### ${name}: dividend`)
      lines.push(`**[Fact]** Yield ${fmtPct(a.valuation.dividendYield, 2)}, payout ${fmtPct(L.payoutRatio)} of earnings and ${fmtPct(L.fcfPayoutRatio)} of FCF, 5-yr DPS growth ${fmtPct(a.fp.growth.dividend.y5, 1, true)}.`)
      lines.push(`Dividend Safety Score: **${a.dividendSafety ?? '—'}/100** (safety ≠ attractiveness; the yield is scored separately).`)
      break
    }
    case 'moat': {
      lines.push(`### ${name}: competitive advantage`)
      lines.push(`Moat: **${a.moat.rating}** (${a.moat.score}/100 = 60% evidenced rubric ${a.moat.qualitative}, 40% quantitative ${a.moat.quantitative}).`)
      for (const m of (a.dataset.qualitative?.moat ?? []).filter((m) => m.strength >= 2)) lines.push(`- **${m.source.replace(/_/g, ' ')}** (${['none', 'weak', 'moderate', 'strong'][m.strength]}): ${m.evidence}`)
      lines.push(`- ROIC ≥ 15% in ${a.fp.roicAbove15Years} of ${a.fp.years.length} years; gross-margin std. dev. ${a.fp.grossMarginStdev?.toFixed(1)} pp.`)
      break
    }
    case 'cash': {
      lines.push(`### ${name}: cash flow quality`)
      lines.push(`**[Fact]** FY${y.fiscalYear}: operating cash flow ${fmtMoney(y.operatingCashFlow)}, capex ${fmtMoney(y.capex)}, free cash flow ${fmtMoney(y.freeCashFlow)} (${fmtPct(L.fcfMargin)} margin, ${fmtPct(L.fcfConversion, 0)} of net income).`)
      const flag = ind('cf.ni_vs_ocf')
      if (flag) lines.push(`- ${flag.label}: ${flag.display} — ${flag.rationale}`)
      break
    }
    case 'score': {
      lines.push(`### Why ${name} scores ${a.overall.score}/100`)
      lines.push(`Start at a neutral 50, then add each category’s weighted contribution:`)
      for (const c of a.overall.categoryContributions) lines.push(`- ${c.key.replace(/_/g, ' ')}: score ${c.score} × ${c.weight.toFixed(1)}% → ${c.points >= 0 ? '+' : ''}${c.points.toFixed(2)}`)
      lines.push(`\nThis is the strength of evidence under the methodology — **not** a ${a.overall.score}% chance of the price rising.`)
      break
    }
    default: {
      lines.push(`### ${name} in brief`)
      lines.push(`Investment Quality **${a.overall.score}/100 (${a.overall.signal})**, data confidence ${a.confidence.score}%. Valuation *${a.labels.valuation}*, balance sheet *${a.labels.balanceSheet}*, moat *${a.moat.rating}*, risk *${a.labels.risk}*.`)
      lines.push('\n**Strengths:**')
      a.strengths.slice(0, 3).forEach((s) => lines.push(`- ${s.label}: ${s.display}`))
      lines.push('**Concerns:**')
      a.concerns.slice(0, 3).forEach((s) => lines.push(`- ${s.label}: ${s.display}`))
      lines.push('\nTry asking about debt, ROIC, valuation, risks, growth, the moat, or the 10-year outlook.')
    }
  }
  return lines.join('\n') + demoNote(sub) + '\n\n_This is information, not personalised financial advice._'
}

function compare(subjects: Subject[]): string {
  const lines = [`### Comparison: ${subjects.map((s) => s.ticker).join(' vs ')}`, '', '| Metric | ' + subjects.map((s) => s.ticker).join(' | ') + ' |', '|---|' + subjects.map(() => '---:').join('|') + '|']
  const get = (s: Subject) => {
    if (s.analysis) {
      const a = s.analysis
      return { rg: a.fp.latest.revenueGrowth, om: a.fp.latest.operatingMargin, roic: a.fp.latest.roic, pe: a.valuation.pe, fy: a.valuation.fcfYield, score: a.overall.score, kind: 'full' }
    }
    const r = s.snapshot
    return r ? { rg: r.revenueGrowth, om: r.operatingMargin, roic: r.roic, pe: r.pe, fy: r.fcfYield, score: r.scores.overall, kind: 'snapshot' } : null
  }
  const vals = subjects.map(get)
  const row = (label: string, f: (v: NonNullable<ReturnType<typeof get>>) => string) => lines.push(`| ${label} | ${vals.map((v) => (v ? f(v) : 'n/a')).join(' | ')} |`)
  row('Revenue growth', (v) => fmtPct(v.rg))
  row('Operating margin', (v) => fmtPct(v.om))
  row('ROIC', (v) => fmtPct(v.roic))
  row('P/E', (v) => fmtX(v.pe))
  row('FCF yield', (v) => fmtPct(v.fy, 2))
  row('Quality score', (v) => `${v.score ?? '—'} (${v.kind})`)
  lines.push('\n“full” = complete methodology; “snapshot” = same curves on headline metrics only. Figures are **demo data** in this deployment. Open the Compare page for charts.')
  return lines.join('\n')
}
