import type { CostEstimate, ResearchProvider, ResearchResult } from './types'
import type { ProviderSecret } from '@/lib/credentials'

// Serper.dev wraps Google Search results (news + web) behind a simple JSON
// API and is the same provider already used by apps/agent's web-search tool.
// Requires the user's own Serper API key. Any provider that returns
// {url,title,snippet} search hits can be dropped in behind this interface.
export class SerperResearchProvider implements ResearchProvider {
  name = 'serper'
  private apiKey: string
  private baseUrl: string

  constructor(secret: ProviderSecret) {
    this.apiKey = secret.apiKey
    this.baseUrl = secret.baseUrl?.replace(/\/$/, '') || 'https://google.serper.dev'
  }

  async search(
    query: string,
    opts: { recency?: 'day' | 'week' | 'month' | 'year' | 'any' } = {}
  ): Promise<ResearchResult[]> {
    const tbsMap: Record<string, string> = {
      day: 'qdr:d',
      week: 'qdr:w',
      month: 'qdr:m',
      year: 'qdr:y',
    }

    const [webRes, newsRes] = await Promise.all([
      fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: { 'X-API-KEY': this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: query,
          num: 8,
          ...(opts.recency && opts.recency !== 'any' ? { tbs: tbsMap[opts.recency] } : {}),
        }),
      }),
      fetch(`${this.baseUrl}/news`, {
        method: 'POST',
        headers: { 'X-API-KEY': this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, num: 5 }),
      }).catch(() => null),
    ])

    if (!webRes.ok) {
      const body = await webRes.text().catch(() => '')
      throw new Error(`Research provider request failed: ${webRes.status} ${body}`)
    }
    const webData = await webRes.json()
    const newsData = newsRes && newsRes.ok ? await newsRes.json() : { news: [] }

    const organic: ResearchResult[] = (webData.organic || []).map((r: any) => ({
      url: r.link,
      title: r.title,
      snippet: r.snippet || '',
      publisher: r.source,
      publishedAt: r.date,
    }))
    const news: ResearchResult[] = (newsData.news || []).map((r: any) => ({
      url: r.link,
      title: r.title,
      snippet: r.snippet || '',
      publisher: r.source,
      publishedAt: r.date,
    }))

    return [...news, ...organic]
  }

  estimateCost(queries: number): CostEstimate {
    // Serper's pay-as-you-go tier is ~$0.001-0.003 per query.
    return { estimatedCostUsd: Number((queries * 0.002).toFixed(4)), unit: 'per-request' }
  }
}
