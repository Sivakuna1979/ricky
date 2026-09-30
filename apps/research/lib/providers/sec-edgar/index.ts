import type { AnnualFinancials, CompanyProfile, Filing, SourceRef } from '@/lib/domain/types'
import { ProviderError, type DataProvider, type SearchResult } from '../types'
import { annualFromFacts, latestFiled, sectorFromSic, sharesOutstanding, type CompanyFacts } from './xbrl'

/**
 * SEC EDGAR adapter — free primary-source data for US filers:
 * company search (all SEC tickers), profile (submissions), annual financial
 * statements (XBRL company facts) and filings.
 *
 * SEC requires a descriptive User-Agent with contact details: set SEC_USER_AGENT,
 * e.g. "Evidentia Research admin@example.com". Fair-access limit: 10 requests/second.
 * Company-facts files can exceed the Next.js data-cache item limit (2 MB), so parsed
 * results are cached in memory instead.
 */
const FORMS = new Set(['10-K', '10-Q', '8-K', 'DEF 14A', '4', '20-F', '6-K', 'S-1', '10-K/A'])
const TTL = 12 * 3600_000

const memo = new Map<string, { at: number; value: unknown }>()
async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key)
  if (hit && Date.now() - hit.at < ttl) return hit.value as T
  const value = await load()
  memo.set(key, { at: Date.now(), value })
  if (memo.size > 500) memo.delete(memo.keys().next().value as string)
  return value
}

async function secJson<T>(url: string): Promise<T> {
  const ua = process.env.SEC_USER_AGENT
  if (!ua) throw new ProviderError('sec-edgar', 'SEC_USER_AGENT not set')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': ua, Accept: 'application/json' }, cache: 'no-store', signal: controller.signal })
    if (res.status === 404) throw new ProviderError('sec-edgar', 'Not found', 404)
    if (!res.ok) throw new ProviderError('sec-edgar', `HTTP ${res.status}`, res.status)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

interface TickerRow {
  cik: number
  name: string
  ticker: string
  exchange: string
}

/** All SEC-registered tickers with exchange (≈10k rows), refreshed daily. */
async function tickerTable(): Promise<TickerRow[]> {
  return cached('tickers', 24 * 3600_000, async () => {
    const t = await secJson<{ fields: string[]; data: (string | number)[][] }>('https://www.sec.gov/files/company_tickers_exchange.json')
    const ix = (k: string) => t.fields.indexOf(k)
    return t.data.map((r) => ({ cik: Number(r[ix('cik')]), name: String(r[ix('name')]), ticker: String(r[ix('ticker')]).toUpperCase(), exchange: String(r[ix('exchange')] ?? '') }))
  })
}

async function lookup(ticker: string): Promise<TickerRow | null> {
  const rows = await tickerTable()
  return rows.find((r) => r.ticker === ticker.toUpperCase().replace('.', '-')) ?? rows.find((r) => r.ticker === ticker.toUpperCase()) ?? null
}

const pad = (cik: number) => String(cik).padStart(10, '0')

interface Submissions {
  name: string
  sic?: string
  sicDescription?: string
  fiscalYearEnd?: string
  exchanges?: string[]
  website?: string
  addresses?: { business?: { stateOrCountryDescription?: string } }
  filings: { recent: { form: string[]; filingDate: string[]; accessionNumber: string[]; primaryDocument: string[]; primaryDocDescription: string[] } }
}

const submissions = (cik: number) => cached(`sub:${cik}`, TTL, () => secJson<Submissions>(`https://data.sec.gov/submissions/CIK${pad(cik)}.json`))
const companyFacts = (cik: number) => cached(`cf:${cik}`, TTL, () => secJson<CompanyFacts>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${pad(cik)}.json`))

export function edgarIndexUrl(cik: string) {
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&owner=include&count=40`
}

/** Latest cover-page shares outstanding, for market-cap calculation. */
export async function secSharesOutstanding(ticker: string): Promise<number | null> {
  const row = await lookup(ticker)
  if (!row) return null
  return sharesOutstanding(await companyFacts(row.cik))
}

let lastFiledCache: Record<string, string | null> = {}

export const secEdgarProvider: DataProvider = {
  id: 'sec-edgar',
  name: 'SEC EDGAR',
  capabilities: ['search', 'profile', 'financials', 'filings'],
  isConfigured: () => Boolean(process.env.SEC_USER_AGENT),
  sourceRef(ticker: string): SourceRef {
    return {
      id: 'sec-edgar',
      name: 'SEC EDGAR — XBRL company facts from 10-K/20-F filings (primary source)',
      tier: 'filing',
      url: 'https://www.sec.gov/edgar/search/#/q=' + encodeURIComponent(ticker),
      period: 'Annual reports',
      updated: lastFiledCache[ticker.toUpperCase()] ?? new Date().toISOString().slice(0, 10),
      note: 'Figures are as reported in XBRL; restated values use the most recent filing.',
    }
  },

  async search(query) {
    const q = query.trim().toLowerCase()
    const rows = await tickerTable()
    const exact = rows.filter((r) => r.ticker.toLowerCase() === q)
    const prefix = rows.filter((r) => r.ticker.toLowerCase().startsWith(q) && r.ticker.toLowerCase() !== q)
    const name = rows.filter((r) => r.name.toLowerCase().includes(q) && !r.ticker.toLowerCase().startsWith(q))
    return [...exact, ...prefix, ...name].slice(0, 10).map<SearchResult>((r) => ({ ticker: r.ticker, name: r.name, exchange: r.exchange, hasFullAnalysis: true }))
  },

  async getProfile(ticker) {
    const row = await lookup(ticker)
    if (!row) return null
    const s = await submissions(row.cik)
    const sic = s.sic ? Number(s.sic) : null
    return {
      ticker: ticker.toUpperCase(),
      name: s.name || row.name,
      exchange: row.exchange || s.exchanges?.[0] || '—',
      country: s.addresses?.business?.stateOrCountryDescription ? (s.addresses.business.stateOrCountryDescription.length === 2 ? 'United States' : s.addresses.business.stateOrCountryDescription) : '—',
      currency: 'USD',
      sector: sectorFromSic(sic),
      industry: s.sicDescription ?? '—',
      description: '',
      website: s.website || undefined,
      cik: pad(row.cik),
      fiscalYearEndMonth: s.fiscalYearEnd ? Number(s.fiscalYearEnd.slice(0, 2)) : undefined,
      employees: null,
      sourceId: 'sec-edgar',
    } satisfies CompanyProfile
  },

  async getAnnualFinancials(ticker, years): Promise<AnnualFinancials[]> {
    const row = await lookup(ticker)
    if (!row) return []
    const cf = await companyFacts(row.cik)
    lastFiledCache[ticker.toUpperCase()] = latestFiled(cf)
    if (Object.keys(lastFiledCache).length > 1000) lastFiledCache = {}
    return annualFromFacts(cf, years, 'sec-edgar')
  },

  async getFilings(ticker) {
    const row = await lookup(ticker)
    if (!row) return []
    const r = (await submissions(row.cik)).filings.recent
    const out: Filing[] = []
    for (let i = 0; i < r.form.length && out.length < 40; i++) {
      if (!FORMS.has(r.form[i])) continue
      const acc = r.accessionNumber[i].replace(/-/g, '')
      out.push({
        form: r.form[i] === '4' ? 'Form 4' : r.form[i],
        filedAt: r.filingDate[i],
        description: r.primaryDocDescription[i] || r.form[i],
        url: `https://www.sec.gov/Archives/edgar/data/${row.cik}/${acc}/${r.primaryDocument[i]}`,
      })
    }
    return out
  },
}
