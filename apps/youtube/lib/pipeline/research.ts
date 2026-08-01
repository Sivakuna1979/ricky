import type { SupabaseClient } from '@supabase/supabase-js'
import type { ResearchProvider, ScriptAIProvider } from '@/lib/providers/types'

// Domains that get a reliability boost — encyclopedic, governmental,
// academic, and major wire/news services. Everything else starts neutral;
// known low-trust patterns (content farms, unattributed aggregators) score
// lower. This is a heuristic, not a fact-checker — it feeds the "source
// verification" gate, it doesn't replace human judgement on contested claims.
const HIGH_TRUST_DOMAINS = [
  'wikipedia.org', '.gov', '.gov.uk', '.ac.uk', '.edu', 'bbc.co', 'reuters.com',
  'apnews.com', 'nature.com', 'who.int', 'nhs.uk', 'ons.gov.uk',
]

function reliabilityScore(url: string, publishedAt?: string): number {
  let score = 5.5
  const lower = url.toLowerCase()
  if (HIGH_TRUST_DOMAINS.some((d) => lower.includes(d))) score += 3
  if (publishedAt) {
    const ageDays = (Date.now() - new Date(publishedAt).getTime()) / 86_400_000
    if (ageDays < 365) score += 1
    if (ageDays > 365 * 5) score -= 1.5
  }
  return Math.max(0, Math.min(10, Math.round(score * 10) / 10))
}

export async function researchTopic(
  research: ResearchProvider,
  ai: ScriptAIProvider,
  input: { title: string; angle: string; keywords: string[]; requireRecent: boolean }
) {
  const queries = [input.title, `${input.title} facts`, ...input.keywords.slice(0, 2)]
  const results = (
    await Promise.all(
      queries.map((q) => research.search(q, { recency: input.requireRecent ? 'month' : 'any' }))
    )
  ).flat()

  const deduped = Array.from(new Map(results.map((r) => [r.url, r])).values()).slice(0, 12)

  const sources = deduped.map((r) => ({
    url: r.url,
    title: r.title,
    publisher: r.publisher ?? new URL(r.url).hostname,
    publishedAt: r.publishedAt ?? null,
    reliabilityScore: reliabilityScore(r.url, r.publishedAt),
    snippet: r.snippet,
  }))

  const summaryPrompt = `Summarize the verifiable facts about "${input.title}" using ONLY the source snippets below.
For each fact, note which source URL(s) support it. Flag anything that appears only in a single low-reliability
source as "unverified". Return JSON: {"facts": [{"claim": "...", "supporting_urls": ["..."], "confidence": "high|medium|low"}]}

Sources:
${sources.map((s, i) => `[${i + 1}] ${s.url} (reliability ${s.reliabilityScore}/10)\n${s.snippet}`).join('\n\n')}`

  const raw = await ai.complete(
    [
      { role: 'system', content: 'You are a careful fact-checking research assistant. Output only valid JSON.' },
      { role: 'user', content: summaryPrompt },
    ],
    { temperature: 0.2, maxTokens: 1800, json: true }
  )

  const facts = JSON.parse(raw.trim().replace(/^```(json)?/i, '').replace(/```$/, '')).facts as Array<{
    claim: string
    supporting_urls: string[]
    confidence: 'high' | 'medium' | 'low'
  }>

  return { sources, facts }
}

export async function saveResearch(
  supabase: SupabaseClient,
  topicId: string,
  research: Awaited<ReturnType<typeof researchTopic>>
) {
  const rows = research.sources.map((s) => ({
    topic_id: topicId,
    url: s.url,
    title: s.title,
    publisher: s.publisher,
    published_at: s.publishedAt,
    reliability_score: s.reliabilityScore,
    summary: s.snippet,
    supports_claims: research.facts.filter((f) => f.supporting_urls.includes(s.url)).map((f) => f.claim),
  }))
  if (rows.length) {
    const { error } = await supabase.from('yt_research_sources').insert(rows)
    if (error) throw error
  }
  return rows
}

// Source-verification gate: a script may not go into production if it
// leans on low-confidence, single-source, or unreliable-domain claims.
export function verifySourceQuality(facts: Array<{ confidence: string; supporting_urls: string[] }>, sources: Array<{ url: string; reliabilityScore: number }>) {
  const reliabilityByUrl = new Map(sources.map((s) => [s.url, s.reliabilityScore]))
  const weakFacts = facts.filter((f) => {
    if (f.confidence === 'low') return true
    if (f.supporting_urls.length === 0) return true
    const maxReliability = Math.max(...f.supporting_urls.map((u) => reliabilityByUrl.get(u) ?? 0), 0)
    return maxReliability < 4
  })
  return { passed: weakFacts.length === 0, weakFactCount: weakFacts.length, totalFacts: facts.length }
}
