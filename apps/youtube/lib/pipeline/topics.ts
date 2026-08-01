import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScriptAIProvider } from '@/lib/providers/types'
import { SCORE_WEIGHTS, type ScoreBreakdown, type VideoType } from '@/lib/types'

export interface TopicCandidate {
  title: string
  angle: string
  videoType: VideoType
  targetKeywords: string[]
  scoreBreakdown: ScoreBreakdown
  isSensitiveTopic: boolean
  sensitivityReason?: string
}

const SENSITIVE_KEYWORDS: Record<string, string[]> = {
  medical: ['cure', 'diagnosis', 'symptom', 'disease', 'treatment', 'medication', 'surgery'],
  legal: ['lawsuit', 'sue', 'illegal', 'legal advice', 'contract law', 'court case'],
  financial: ['investment advice', 'guaranteed return', 'stock tip', 'get rich', 'crypto pump'],
  political: ['election', 'political party', 'president', 'prime minister', 'senator', 'vote for'],
  tragic_event: ['shooting', 'disaster', 'terrorist', 'died', 'death toll', 'victims'],
  celebrity_rumour: ['rumor', 'rumour', 'allegedly dating', 'secretly', 'leaked'],
  childrens_content: ['nursery rhyme', 'for kids', 'toddler', 'preschool'],
}

export function detectSensitivity(text: string): { sensitive: boolean; reason?: string } {
  const lower = text.toLowerCase()
  for (const [category, keywords] of Object.entries(SENSITIVE_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) {
      return { sensitive: true, reason: category }
    }
  }
  return { sensitive: false }
}

export function normalizeForDedup(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .sort()
    .join(' ')
}

export function dedupHash(title: string): string {
  return createHash('sha256').update(normalizeForDedup(title)).digest('hex')
}

// Simple token-Jaccard similarity — enough to catch "5 Ways to Save Money
// Fast" vs "5 Fast Ways to Save Money" without needing an embeddings call
// for every candidate.
function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(normalizeForDedup(a).split(' '))
  const setB = new Set(normalizeForDedup(b).split(' '))
  const intersection = [...setA].filter((w) => setB.has(w)).length
  const union = new Set([...setA, ...setB]).size
  return union === 0 ? 0 : intersection / union
}

export async function findDuplicateTopic(
  supabase: SupabaseClient,
  channelId: string,
  title: string,
  windowDays = 120
) {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('yt_topics')
    .select('id, title, status')
    .eq('channel_id', channelId)
    .neq('status', 'rejected')
    .gte('created_at', since)
  if (error) throw error

  const exactHash = dedupHash(title)
  for (const row of data ?? []) {
    if (dedupHash(row.title) === exactHash) return { duplicate: true, matchId: row.id, similarity: 1, reason: 'exact' as const }
    const sim = jaccardSimilarity(title, row.title)
    if (sim >= 0.72) return { duplicate: true, matchId: row.id, similarity: sim, reason: 'near-duplicate' as const }
  }
  return { duplicate: false as const }
}

function scoreOverall(breakdown: Omit<ScoreBreakdown, 'total'>): number {
  const w = SCORE_WEIGHTS
  // production_difficulty and copyright_risk are inverted: a HIGH raw
  // score there means low difficulty / low risk was reported by the model,
  // so it already points the right direction — no extra inversion needed
  // as long as prompts ask for scores where 10 = best outcome.
  const total =
    breakdown.search_demand * w.search_demand +
    breakdown.competition * w.competition +
    breakdown.advertiser_suitability * w.advertiser_suitability +
    breakdown.production_difficulty * w.production_difficulty +
    breakdown.evergreen_potential * w.evergreen_potential +
    breakdown.originality_potential * w.originality_potential +
    breakdown.copyright_risk * w.copyright_risk +
    breakdown.retention_potential * w.retention_potential +
    breakdown.uk_intl_potential * w.uk_intl_potential
  return Math.round(total * 10) / 10 // out of 10 * 10 weight sum(~1) => already ~0-10, scaled below
}

export async function generateTopicCandidates(
  ai: ScriptAIProvider,
  input: { nicheName: string; nicheDescription: string; allowedVideoTypes: VideoType[]; recentTitles: string[]; count: number }
): Promise<TopicCandidate[]> {
  const prompt = `You are a YouTube content strategist. Propose ${input.count} ORIGINAL video topic ideas for the niche "${input.nicheName}" (${input.nicheDescription}).

Allowed video types: ${input.allowedVideoTypes.join(', ')}.
Avoid anything similar to these already-used titles: ${input.recentTitles.slice(0, 40).join(' | ') || '(none yet)'}.

For each idea score these 9 dimensions from 0-10 where 10 is always the BEST outcome for the channel
(so for "production_difficulty" and "copyright_risk", 10 means EASY to produce / LOW risk):
search_demand, competition (10 = low competition), advertiser_suitability, production_difficulty (10 = easy),
evergreen_potential, originality_potential, copyright_risk (10 = low risk), retention_potential, uk_intl_potential.

Return ONLY a JSON object: {"topics": [{"title": "...", "angle": "...", "video_type": "explainer|list|educational|story|product_comparison|news", "target_keywords": ["..."], "scores": {"search_demand":0,"competition":0,"advertiser_suitability":0,"production_difficulty":0,"evergreen_potential":0,"originality_potential":0,"copyright_risk":0,"retention_potential":0,"uk_intl_potential":0}}]}`

  const raw = await ai.complete(
    [
      { role: 'system', content: 'You output only valid JSON, no markdown fences, no commentary.' },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.9, maxTokens: 2500, json: true }
  )

  const parsed = JSON.parse(stripJsonFences(raw)) as {
    topics: Array<{
      title: string
      angle: string
      video_type: VideoType
      target_keywords: string[]
      scores: Omit<ScoreBreakdown, 'total'>
    }>
  }

  return parsed.topics.map((t) => {
    const sensitivity = detectSensitivity(`${t.title} ${t.angle}`)
    const total = scoreOverall(t.scores)
    return {
      title: t.title,
      angle: t.angle,
      videoType: t.video_type,
      targetKeywords: t.target_keywords || [],
      scoreBreakdown: { ...t.scores, total },
      isSensitiveTopic: sensitivity.sensitive,
      sensitivityReason: sensitivity.reason,
    }
  })
}

function stripJsonFences(text: string): string {
  return text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim()
}
