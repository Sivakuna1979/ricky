/**
 * "Explain Simply" content. Simple explanations use plain language and, where
 * useful, a worked example driven by the actual value. Advanced explanations
 * give the formula and interpretation caveats. Original wording throughout.
 */
export interface GlossaryEntry {
  term: string
  simple: (v: string, sym: string) => string
  advanced: string
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  roic: {
    term: 'Return on invested capital (ROIC)',
    simple: (v, s) => `ROIC ${v}: for every ${s}100 of money invested in the business (by lenders and shareholders), the company generated roughly ${s}${parseFloat(v) || '—'} of operating profit after tax in the latest year, according to this calculation.`,
    advanced: 'NOPAT ÷ invested capital, where NOPAT = EBIT × (1 − effective tax rate) and invested capital = total debt + equity − cash − short-term investments. Very high values can occur when a company runs with negative working capital or has shrunk book equity through buybacks; compare against the trend and peers rather than reading the level alone.',
  },
  roe: {
    term: 'Return on equity (ROE)',
    simple: (v, s) => `ROE ${v}: profit earned for each ${s}100 of shareholders’ money recorded on the balance sheet. Big buybacks shrink that recorded money, which can make ROE look unusually high.`,
    advanced: 'Net income ÷ average shareholders’ equity. Sensitive to leverage and buybacks; DuPont analysis separates margin, asset turnover and leverage. The platform caps its ROE score when debt exceeds equity.',
  },
  roa: {
    term: 'Return on assets (ROA)',
    simple: (v, s) => `ROA ${v}: profit generated for every ${s}100 of assets the company owns.`,
    advanced: 'Net income ÷ average total assets. Less distorted by leverage than ROE; lower for capital-intensive industries.',
  },
  grossMargin: {
    term: 'Gross margin',
    simple: (v, s) => `Gross margin ${v}: of every ${s}100 of sales, about ${s}${parseFloat(v) || '—'} is left after paying the direct cost of making the product or delivering the service.`,
    advanced: 'Gross profit ÷ revenue. Stable or rising gross margins across cycles are one of the more reliable quantitative signals of pricing power.',
  },
  operatingMargin: {
    term: 'Operating margin',
    simple: (v, s) => `Operating margin ${v}: of every ${s}100 of sales, about ${s}${parseFloat(v) || '—'} is left after all normal running costs (materials, staff, R&D, marketing), before interest and tax.`,
    advanced: 'Operating income (EBIT) ÷ revenue. Reflects both pricing power and cost discipline; compare with peers because industry structures differ widely.',
  },
  netMargin: {
    term: 'Net margin',
    simple: (v, s) => `Net margin ${v}: of every ${s}100 of sales, about ${s}${parseFloat(v) || '—'} ends up as profit after every cost, interest and tax.`,
    advanced: 'Net income ÷ revenue. Can be affected by one-off tax items and non-operating gains — check the operating margin alongside.',
  },
  fcfMargin: {
    term: 'Free cash flow margin',
    simple: (v, s) => `FCF margin ${v}: of every ${s}100 of sales, about ${s}${parseFloat(v) || '—'} becomes spare cash after running the business and paying for new equipment.`,
    advanced: '(Operating cash flow − capital expenditure) ÷ revenue. Note FCF excludes stock-based compensation as a cash cost; the platform shows SBC separately.',
  },
  fcfConversion: {
    term: 'FCF conversion',
    simple: (v) => `FCF conversion ${v}: how much of the reported profit actually showed up as spare cash. Around 100% means profits are backed by real cash.`,
    advanced: 'Free cash flow ÷ net income. Persistent values well below 100% can indicate aggressive revenue recognition, rising working capital, or heavy reinvestment.',
  },
  currentRatio: {
    term: 'Current ratio',
    simple: (v) => `Current ratio ${v}: short-term assets divided by bills due within a year. Above 1 means there is more short-term money than short-term bills.`,
    advanced: 'Current assets ÷ current liabilities. Businesses paid upfront by customers (negative working capital) can safely run below 1; judge alongside cash generation and long-term investments.',
  },
  quickRatio: {
    term: 'Quick ratio',
    simple: (v) => `Quick ratio ${v}: like the current ratio, but only counts cash-like assets that can be used quickly (not inventory).`,
    advanced: '(Cash + short-term investments + receivables) ÷ current liabilities.',
  },
  debtToEquity: {
    term: 'Debt to equity',
    simple: (v) => `Debt/equity ${v}: how much the company has borrowed compared with the shareholders’ money on its books.`,
    advanced: 'Total debt ÷ shareholders’ equity. Book equity can be depressed by buybacks, so debt/EBITDA and interest coverage are often better measures of affordability.',
  },
  netDebtToEbitda: {
    term: 'Net debt / EBITDA',
    simple: (v) => `Net debt/EBITDA ${v}: roughly how many years of operating earnings it would take to pay off debt after using the cash in the bank. Below 1 is low; above 3 is high for most businesses.`,
    advanced: '(Total debt − cash − short-term investments) ÷ EBITDA. Negative values mean net cash. The platform excludes long-term investments to stay conservative.',
  },
  interestCoverage: {
    term: 'Interest coverage',
    simple: (v) => `Interest coverage ${v}: how many times operating profit could pay the yearly interest bill.`,
    advanced: 'EBIT ÷ interest expense. Some companies no longer disclose interest expense separately; the figure is then shown as unavailable rather than estimated.',
  },
  revenueGrowth: {
    term: 'Revenue growth',
    simple: (v) => `Revenue growth ${v}: how much more (or less) the company sold compared with the year before.`,
    advanced: 'Year-over-year change in reported revenue. Watch for currency effects, acquisitions and one-off items; organic growth is not separated in this version.',
  },
  cagr: {
    term: 'CAGR',
    simple: (v) => `CAGR ${v}: the steady yearly growth rate that would take the starting value to the ending value over the period.`,
    advanced: '(End ÷ start)^(1/years) − 1. Smooths volatility, so it hides the path; the growth charts show the year-by-year history.',
  },
  eps: {
    term: 'Earnings per share (EPS)',
    simple: () => 'EPS: company profit divided by the number of shares. It can grow because profits grow, or because the company buys back its own shares.',
    advanced: 'Diluted EPS uses the weighted-average diluted share count. Compare EPS growth with net income growth to see how much comes from buybacks.',
  },
  pe: {
    term: 'Price / earnings (P/E)',
    simple: (v) => `P/E ${v}: you pay about ${parseFloat(v) || '—'} dollars for every dollar of yearly profit. Higher means investors expect more growth, or the stock is more expensive.`,
    advanced: 'Price ÷ diluted EPS (latest fiscal year). Compared against the company’s own 5/10-year average, the industry median and peers — never judged alone.',
  },
  forwardPe: {
    term: 'Forward P/E',
    simple: () => 'Forward P/E: price divided by the profit analysts expect next year. It depends on third-party forecasts, which can be wrong.',
    advanced: 'Price ÷ consensus next-fiscal-year EPS.',
  },
  peg: {
    term: 'PEG ratio',
    simple: (v) => `PEG ${v}: the P/E divided by the expected growth rate. Around 1 suggests the price is in line with growth; well above 2 suggests you are paying a lot for each unit of growth.`,
    advanced: 'P/E ÷ EPS growth rate (%). Uses consensus long-term growth when available, otherwise historical 5-year EPS CAGR. Unreliable for very slow or cyclical growth.',
  },
  ps: { term: 'Price / sales', simple: () => 'Price/sales: company value divided by yearly sales.', advanced: 'Market cap ÷ revenue. Useful for comparing businesses with depressed earnings; ignores margins.' },
  pb: { term: 'Price / book', simple: () => 'Price/book: company value divided by the net assets on its balance sheet.', advanced: 'Market cap ÷ shareholders’ equity. Less meaningful for asset-light companies whose key assets (brands, software, networks) are not recorded.' },
  evToEbitda: { term: 'EV / EBITDA', simple: () => 'EV/EBITDA: the value of the whole business (including debt, minus cash) divided by operating earnings before depreciation.', advanced: 'Enterprise value ÷ EBITDA. Capital-structure neutral; ignores capex needs, so compare with EV/EBIT and P/FCF.' },
  evToEbit: { term: 'EV / EBIT', simple: () => 'EV/EBIT: value of the whole business divided by operating profit.', advanced: 'Enterprise value ÷ EBIT. Inverse of Greenblatt’s earnings yield.' },
  pfcf: { term: 'Price / FCF', simple: () => 'Price/FCF: company value divided by the spare cash it produced last year.', advanced: 'Market cap ÷ free cash flow.' },
  fcfYield: {
    term: 'FCF yield',
    simple: (v, s) => `FCF yield ${v}: if you bought the whole company for ${s}100, it produced about ${s}${parseFloat(v) || '—'} of spare cash last year.`,
    advanced: 'Free cash flow ÷ market cap. Compare with bond yields: a low FCF yield implies the price relies on future growth.',
  },
  earningsYield: { term: 'Earnings yield (EBIT/EV)', simple: () => 'Earnings yield: operating profit as a percentage of the value of the whole business — the “cheapness” half of the Magic Formula.', advanced: 'EBIT ÷ enterprise value (Greenblatt definition).' },
  dividendYield: { term: 'Dividend yield', simple: (v, s) => `Dividend yield ${v}: yearly dividends of about ${s}${parseFloat(v) || '—'} for every ${s}100 invested at today’s price.`, advanced: 'Dividend per share ÷ price.' },
  payoutRatio: { term: 'Payout ratio', simple: () => 'Payout ratio: the share of profit paid out as dividends. Lower leaves more room to keep paying in bad years.', advanced: 'Dividends ÷ net income. The FCF payout ratio is usually more informative.' },
  dcf: { term: 'Discounted cash flow (DCF)', simple: () => 'DCF: estimates what a business is worth today by adding up the cash it might produce in future, with future cash counted as worth less than cash today. The answer depends heavily on the assumptions.', advanced: 'Two-stage FCF model: explicit growth for 5 years, linear fade to terminal growth over years 6–10, Gordon-growth terminal value, discounted at WACC; subtract net debt and divide by diluted shares.' },
  moat: { term: 'Economic moat', simple: () => 'Moat: something that protects a company’s profits from competitors — like a strong brand, customers who find it hard to switch, or a network that gets better as more people join.', advanced: 'Scored from an evidenced rubric of 10 moat sources (60%) and quantitative proxies — ROIC persistence, gross-margin stability and pricing power (40%).' },
  sbc: { term: 'Stock-based compensation', simple: () => 'Stock-based pay: employees paid in shares instead of cash. It is a real cost to owners because it creates new shares, even though no cash leaves the company.', advanced: 'Added back in operating cash flow, so FCF overstates owner earnings by roughly the SBC amount unless buybacks offset the dilution.' },
  dilution: { term: 'Share dilution', simple: () => 'Dilution: when a company issues new shares, each existing share owns a smaller slice. Buybacks do the opposite.', advanced: 'Measured as the CAGR of diluted weighted-average shares.' },
  rsi: { term: 'RSI (14)', simple: () => 'RSI: a 0–100 gauge of recent price momentum. Above 70 is often called “overbought”, below 30 “oversold”. It says nothing about the business.', advanced: 'Wilder’s Relative Strength Index over 14 days.' },
}
