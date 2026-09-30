import PDFDocument from 'pdfkit'
import type { CompanyAnalysis } from '@/lib/analysis/build'
import { categoryScore } from '@/lib/scoring/engine'
import { CATEGORY_LABELS } from '@/lib/scoring/types'
import { fmtDate, fmtMoney, fmtPct, fmtPrice, fmtX } from '@/lib/format'
import { DISCLAIMER_TEXT } from '@/lib/content/disclaimer'

/** Standard PDF fonts are WinAnsi-encoded; map the typographic symbols we use. */
function t(s: string): string {
  return s
    .replace(/−/g, '-')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/→/g, '->')
    .replace(/≈/g, '~')
    .replace(/≠/g, '!=')
    .replace(/Σ/g, 'Sum ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ‘’“”–—•…€]/g, '')
}

const INK = '#0b1220'
const MUTED = '#5b6a86'
const ACCENT = '#2f74f0'
const POS = '#1f9d5c'
const NEG = '#c93c3c'
const AMBER = '#b7791f'

export function renderReport(a: CompanyAnalysis): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 56, bottom: 60, left: 50, right: 50 }, bufferPages: true, info: { Title: `${a.dataset.profile.name} research report`, Author: 'Evidentia Research' } })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))))

  const ds = a.dataset
  const W = doc.page.width - 100
  const demo = ds.mode === 'demo'

  const h1 = (s: string) => doc.font('Helvetica-Bold').fontSize(20).fillColor(INK).text(t(s))
  const h2 = (s: string) => {
    if (doc.y > doc.page.height - 140) doc.addPage()
    doc.moveDown(0.8).font('Helvetica-Bold').fontSize(13).fillColor(ACCENT).text(t(s)).moveDown(0.3)
  }
  const p = (s: string, opts: PDFKit.Mixins.TextOptions = {}) => doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(t(s), { lineGap: 2, ...opts })
  const muted = (s: string) => doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(t(s), { lineGap: 1.5 })
  const bullet = (s: string, color = INK) => {
    doc.font('Helvetica').fontSize(9.5).fillColor(color).text(t(`•  ${s}`), { indent: 6, lineGap: 2 })
  }
  const table = (head: string[], rows: string[][], widths?: number[]) => {
    const w = widths ?? head.map((_, i) => (i === 0 ? W * 0.34 : (W * 0.66) / (head.length - 1)))
    const rowH = 15
    const draw = (cells: string[], bold: boolean, y: number) => {
      let x = 50
      cells.forEach((c, i) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor(bold ? MUTED : INK).text(t(c), x + 3, y + 4, { width: w[i] - 6, align: i === 0 ? 'left' : 'right', lineBreak: false, ellipsis: true })
        x += w[i]
      })
    }
    if (doc.y > doc.page.height - 60 - rowH * (rows.length + 1)) doc.addPage()
    let y = doc.y
    draw(head, true, y)
    y += rowH
    doc.moveTo(50, y).lineTo(50 + W, y).strokeColor('#d5dbe6').lineWidth(0.6).stroke()
    for (const r of rows) {
      if (y > doc.page.height - 80) {
        doc.addPage()
        y = doc.y
      }
      draw(r, false, y)
      y += rowH
    }
    doc.x = 50
    doc.y = y + 6
  }

  // ── Cover ──
  doc.font('Helvetica-Bold').fontSize(9).fillColor(ACCENT).text('EVIDENTIA RESEARCH REPORT')
  doc.moveDown(0.4)
  h1(`${ds.profile.name} (${ds.profile.ticker})`)
  muted(`${ds.profile.exchange} · ${ds.profile.sector} · ${ds.profile.industry} · Generated ${fmtDate(new Date().toISOString())}`)
  if (demo) {
    doc.moveDown(0.6)
    const y = doc.y
    doc.rect(50, y, W, 34).fillColor('#fff6e5').fill()
    doc.font('Helvetica-Bold').fontSize(9).fillColor(AMBER).text('DEMO DATA', 58, y + 6)
    doc.font('Helvetica').fontSize(8.5).fillColor(INK).text(t('Figures come from an illustrative demo dataset and have not been verified against company filings. Do not use for decisions.'), 58, y + 18, { width: W - 16 })
    doc.x = 50
    doc.y = y + 42
  }

  // ── Executive summary ──
  h2('Executive summary')
  const cats = a.categories
  table(
    ['Measure', 'Score', 'Reading'],
    [
      ['Investment Quality Score', `${a.overall.score}/100`, a.overall.signal],
      ['Data confidence', `${a.confidence.score}%`, demo ? 'Demo dataset' : ''],
      ['Financial strength', `${categoryScore(cats, 'financial_strength')}`, a.labels.balanceSheet ?? ''],
      ['Valuation', `${categoryScore(cats, 'valuation')}`, a.labels.valuation ?? ''],
      ['Moat', `${a.moat.score ?? '—'}`, a.moat.rating ?? ''],
      ['Growth', `${categoryScore(cats, 'growth')}`, a.fp.revenueTrend],
      ['Risk (higher = safer)', `${categoryScore(cats, 'risk')}`, a.labels.risk ?? ''],
    ],
    [W * 0.4, W * 0.2, W * 0.4],
  )
  p(`The score measures the strength of evidence under a published, deterministic methodology. It is not a probability that the share price will rise and not a recommendation.`)
  doc.moveDown(0.4)
  doc.font('Helvetica-Bold').fontSize(10).fillColor(POS).text('Why investors may be attracted')
  a.strengths.forEach((s) => bullet(`${s.label}: ${s.display}`))
  doc.moveDown(0.3).font('Helvetica-Bold').fontSize(10).fillColor(NEG).text('What could go wrong')
  a.concerns.forEach((s) => bullet(`${s.label}: ${s.display}`))

  // ── Company ──
  h2('Company')
  p(ds.profile.description)
  if (ds.qualitative) ds.qualitative.businessModel.forEach((b) => bullet(b))
  if (ds.segments) {
    doc.moveDown(0.3)
    const tot = ds.segments.byProduct.reduce((s, x) => s + x.value, 0)
    table(['Revenue by segment (FY' + ds.segments.fiscalYear + ')', 'Revenue', 'Share'], ds.segments.byProduct.map((x) => [x.name, fmtMoney(x.value), fmtPct((x.value / tot) * 100)]))
  }

  // ── Financials ──
  h2('Financials (last 5 fiscal years)')
  const last = ds.annual.slice(-5)
  table(
    ['', ...last.map((y) => `FY${y.fiscalYear}`)],
    [
      ['Revenue', ...last.map((y) => fmtMoney(y.revenue))],
      ['Operating income', ...last.map((y) => fmtMoney(y.operatingIncome))],
      ['Net income', ...last.map((y) => fmtMoney(y.netIncome))],
      ['Diluted EPS', ...last.map((y) => (y.epsDiluted === null ? '—' : `$${y.epsDiluted.toFixed(2)}`))],
      ['Free cash flow', ...last.map((y) => fmtMoney(y.freeCashFlow))],
      ['Total debt', ...last.map((y) => fmtMoney(y.totalDebt))],
      ['Operating margin', ...last.map((y) => fmtPct(a.fp.years[ds.annual.indexOf(y)].operatingMargin))],
      ['ROIC', ...last.map((y) => fmtPct(a.fp.years[ds.annual.indexOf(y)].roic))],
    ],
  )

  // ── Growth ──
  h2('Growth')
  const g = a.fp.growth
  table(
    ['CAGR', '1 yr', '3 yr', '5 yr', '10 yr'],
    [
      ['Revenue', g.revenue.y1, g.revenue.y3, g.revenue.y5, g.revenue.y10],
      ['EPS', g.eps.y1, g.eps.y3, g.eps.y5, g.eps.y10],
      ['Free cash flow', g.fcf.y1, g.fcf.y3, g.fcf.y5, g.fcf.y10],
    ].map(([l, ...v]) => [l as string, ...(v as (number | null)[]).map((x) => fmtPct(x, 1, true))]),
  )

  // ── Valuation ──
  h2('Valuation')
  table(
    ['Multiple', 'Current', '5-yr avg', '10-yr avg', 'Industry', 'vs refs'],
    a.multiples
      .filter((m) => ['pe', 'forwardPe', 'evToEbitda', 'pfcf', 'ps', 'fcfYield'].includes(m.key))
      .map((m) => {
        const f = (v: number | null) => (m.key === 'fcfYield' ? fmtPct(v, 2) : fmtX(v))
        return [m.label, f(m.current), f(m.avg5), f(m.avg10), f(m.industry), m.premiumPct === null ? '—' : `${m.premiumPct >= 0 ? '+' : ''}${m.premiumPct.toFixed(0)}%`]
      }),
  )
  if (a.dcf.length) {
    table(
      ['DCF case', 'FCF growth', 'WACC', 'Terminal', 'Fair value', 'Margin of safety'],
      a.dcf.map((d) => [d.name, `${d.inputs.fcfGrowth}%`, `${d.inputs.wacc}%`, `${d.inputs.terminalGrowth}%`, fmtPrice(d.result.perShare), d.marginOfSafety === null ? '—' : `${d.marginOfSafety.toFixed(0)}%`]),
    )
    if (a.impliedGrowth !== null) p(`Reverse DCF: the current price of ${fmtPrice(a.valuation.price)} implies about ${a.impliedGrowth.toFixed(1)}% annual FCF growth for five years at the base-case discount rate.`)
  }

  // ── Moat & management ──
  h2('Economic moat')
  p(`Moat rating: ${a.moat.rating ?? 'unavailable'} (${a.moat.score ?? '—'}/100; qualitative ${a.moat.qualitative ?? '—'}, quantitative ${a.moat.quantitative ?? '—'}).`)
  ds.qualitative?.moat.filter((m) => m.strength >= 2).forEach((m) => bullet(`${m.source.replace(/_/g, ' ')} (${['none', 'weak', 'moderate', 'strong'][m.strength]}): ${m.evidence}`))
  h2('Management & capital allocation')
  p(`Capital Allocation Score ${categoryScore(cats, 'management')}/100. Share count change ${fmtPct(a.dilution.rate5, 1, true)} per year over 5 years.`)
  a.categories.find((c) => c.key === 'management')!.indicators.filter((i) => i.score !== null).forEach((i) => bullet(`${i.label}: ${i.display}`))

  // ── Risks ──
  h2('Risks')
  a.topRisks.forEach((r, i) => bullet(`${i + 1}. ${r.label} (${r.display}): ${r.rationale}`))

  // ── Scenarios ──
  h2('Scenarios (5 years; modelled, not predicted)')
  table(
    ['Case', 'Revenue', 'EPS', 'FCF', 'Value range'],
    a.scenarios.map((s) => [s.name, fmtMoney(s.revenue), `$${s.eps.toFixed(2)}`, fmtMoney(s.fcf), `$${s.valueLow.toFixed(0)} - $${s.valueHigh.toFixed(0)}`]),
  )

  // ── Checklist ──
  h2(`Investment checklist (${a.checklist.counts.pass} positive · ${a.checklist.counts.neutral} neutral · ${a.checklist.counts.fail} negative)`)
  for (const i of a.checklist.items) {
    const mark = i.status === 'pass' ? '[+]' : i.status === 'fail' ? '[-]' : i.status === 'neutral' ? '[~]' : '[?]'
    bullet(`${mark} ${i.question} — ${i.evidence}`, i.status === 'pass' ? POS : i.status === 'fail' ? NEG : INK)
  }

  // ── Scores by category ──
  h2('Category scores and weights (balanced mode)')
  table(
    ['Category', 'Score', 'Weight', 'Points vs 50'],
    a.overall.categoryContributions.map((c) => [CATEGORY_LABELS[c.key], `${c.score}`, `${c.weight.toFixed(1)}%`, `${c.points >= 0 ? '+' : ''}${c.points.toFixed(2)}`]),
  )

  // ── Sources ──
  h2('Sources')
  Object.values(ds.sources).forEach((s) => bullet(`${s.name}${s.period ? ` · ${s.period}` : ''} · updated ${fmtDate(s.updated)}${s.url ? ` · ${s.url}` : ''}`))
  doc.moveDown(0.6)
  muted(DISCLAIMER_TEXT)

  // Footer on every page
  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)
    doc.font('Helvetica').fontSize(7).fillColor(MUTED).text(t(`Evidentia · ${ds.profile.ticker} · ${demo ? 'DEMO DATA · ' : ''}Not personalised financial advice · Page ${i + 1} of ${range.count}`), 50, doc.page.height - 40, { width: W, align: 'center', lineBreak: false })
  }
  doc.end()
  return done
}
