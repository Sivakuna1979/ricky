import type { Filing, SourceRef } from '@/lib/domain/types'
import { fetchJson, type DataProvider } from '../types'

/**
 * SEC EDGAR adapter (free, US-listed companies). EDGAR requires a descriptive
 * User-Agent with contact details — set SEC_USER_AGENT, e.g.
 * "Evidentia Research admin@example.com". Rate limit: 10 requests/second.
 */
const FORMS = new Set(['10-K', '10-Q', '8-K', 'DEF 14A', '4', '20-F', '6-K', 'S-1'])

function headers() {
  return { 'User-Agent': process.env.SEC_USER_AGENT ?? '', Accept: 'application/json' }
}

async function cikFor(ticker: string): Promise<string | null> {
  const map = await fetchJson<Record<string, { cik_str: number; ticker: string }>>('sec-edgar', 'https://www.sec.gov/files/company_tickers.json', {
    headers: headers(),
    revalidateSeconds: 86400,
  })
  const hit = Object.values(map).find((r) => r.ticker.toUpperCase() === ticker.toUpperCase())
  return hit ? String(hit.cik_str).padStart(10, '0') : null
}

export function edgarIndexUrl(cik: string) {
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&owner=include&count=40`
}

export const secEdgarProvider: DataProvider = {
  id: 'sec-edgar',
  name: 'SEC EDGAR',
  capabilities: ['filings'],
  isConfigured: () => Boolean(process.env.SEC_USER_AGENT),
  sourceRef(): SourceRef {
    return { id: 'sec-edgar', name: 'SEC EDGAR submissions API', tier: 'filing', url: 'https://www.sec.gov/edgar/search/', updated: new Date().toISOString().slice(0, 10) }
  },

  async getFilings(ticker) {
    const cik = await cikFor(ticker)
    if (!cik) return []
    const data = await fetchJson<{
      filings: { recent: { form: string[]; filingDate: string[]; accessionNumber: string[]; primaryDocument: string[]; primaryDocDescription: string[] } }
    }>('sec-edgar', `https://data.sec.gov/submissions/CIK${cik}.json`, { headers: headers(), revalidateSeconds: 3600 })
    const r = data.filings.recent
    const out: Filing[] = []
    for (let i = 0; i < r.form.length && out.length < 40; i++) {
      if (!FORMS.has(r.form[i])) continue
      const acc = r.accessionNumber[i].replace(/-/g, '')
      out.push({
        form: r.form[i] === '4' ? 'Form 4' : r.form[i],
        filedAt: r.filingDate[i],
        description: r.primaryDocDescription[i] || r.form[i],
        url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc}/${r.primaryDocument[i]}`,
      })
    }
    return out
  },
}
