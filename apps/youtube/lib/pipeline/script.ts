import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScriptAIProvider } from '@/lib/providers/types'
import type { ScriptScene, VideoType } from '@/lib/types'
import { normalizeForDedup } from './topics'

export interface GeneratedScript {
  hook: string
  scenes: ScriptScene[]
  fullText: string
  wordCount: number
  estimatedDurationSeconds: number
  aiDisclosureRequired: boolean
}

export async function generateScript(
  ai: ScriptAIProvider,
  input: {
    title: string
    angle: string
    videoType: VideoType
    videoKind: 'short' | 'long'
    facts: Array<{ claim: string; confidence: string }>
    recentHooks: string[]
  }
): Promise<GeneratedScript> {
  const targetSeconds = input.videoKind === 'short' ? 45 : 480
  const prompt = `Write an ORIGINAL, engaging ${input.videoType} video script titled "${input.title}" (angle: ${input.angle}).
Target length: ~${targetSeconds} seconds of spoken narration (${input.videoKind === 'short' ? 'YouTube Short, 9:16' : 'long-form, 16:9'}).

Ground every factual claim in this verified research (do not invent facts beyond it):
${input.facts.map((f) => `- ${f.claim} (confidence: ${f.confidence})`).join('\n')}

Hard requirements:
- The opening hook (first 1-2 sentences) must be DIFFERENT in wording and structure from these recently used hooks: ${input.recentHooks.slice(0, 15).join(' || ') || '(none yet)'}
- Break the script into numbered scenes. Each scene needs: the narration line, a visual_direction describing what should be on screen (specific enough to search stock footage or generate a graphic for), optional on_screen_text, and an estimated duration in seconds.
- Do not copy phrasing from any source verbatim — write everything in your own words.
- End long-form videos with a clear call to action; end Shorts with a punchy final line, no dead air.

Return ONLY JSON: {"hook": "...", "scenes": [{"index":1,"text":"...","visual_direction":"...","on_screen_text":"...","duration_seconds":0}]}`

  const raw = await ai.complete(
    [
      { role: 'system', content: 'You are an award-winning YouTube scriptwriter. Output only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.85, maxTokens: 3000, json: true }
  )

  const parsed = JSON.parse(raw.trim().replace(/^```(json)?/i, '').replace(/```$/, '')) as {
    hook: string
    scenes: ScriptScene[]
  }

  const fullText = [parsed.hook, ...parsed.scenes.map((s) => s.text)].join(' ')
  const wordCount = fullText.trim().split(/\s+/).filter(Boolean).length
  const estimatedDurationSeconds = parsed.scenes.reduce((sum, s) => sum + (s.duration_seconds || 0), 0)

  return {
    hook: parsed.hook,
    scenes: parsed.scenes,
    fullText,
    wordCount,
    estimatedDurationSeconds: estimatedDurationSeconds || Math.round((wordCount / 150) * 60),
    aiDisclosureRequired: true,
  }
}

// --- Originality checks ----------------------------------------------------

function shingles(text: string, size = 6): Set<string> {
  const words = normalizeForDedup(text).split(' ').filter(Boolean)
  const out = new Set<string>()
  for (let i = 0; i <= words.length - size; i++) out.add(words.slice(i, i + size).join(' '))
  return out
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const x of a) if (b.has(x)) intersection++
  return intersection / new Set([...a, ...b]).size
}

/**
 * Compares a new script's 6-word shingles against every prior script on the
 * channel (and, if provided, against research-source snippets) to catch
 * near-duplicate or lightly-reworded reuse. Returns an originality score
 * 0-10 (10 = fully original) and the closest match if similarity is high.
 */
export async function checkScriptOriginality(
  supabase: SupabaseClient,
  channelId: string,
  scriptId: string | null,
  fullText: string,
  sourceSnippets: string[]
) {
  const { data: priorScripts, error } = await supabase
    .from('yt_scripts')
    .select('id, content, topic_id, yt_topics!inner(channel_id)')
    .eq('yt_topics.channel_id', channelId)
    .neq('id', scriptId ?? '00000000-0000-0000-0000-000000000000')
    .limit(200)
  if (error) throw error

  const newShingles = shingles(fullText)
  let worstSimilarity = 0
  let closestScriptId: string | null = null

  for (const row of priorScripts ?? []) {
    const sim = jaccard(newShingles, shingles(row.content))
    if (sim > worstSimilarity) {
      worstSimilarity = sim
      closestScriptId = row.id
    }
  }

  // Verbatim-copy check against the source material itself.
  let maxSourceOverlap = 0
  for (const snippet of sourceSnippets) {
    const sim = jaccard(newShingles, shingles(snippet))
    maxSourceOverlap = Math.max(maxSourceOverlap, sim)
  }

  const worst = Math.max(worstSimilarity, maxSourceOverlap)
  const originalityScore = Math.max(0, Math.round((1 - worst) * 100) / 10)

  return {
    originalityScore,
    passed: worst < 0.35,
    closestPriorScriptId: closestScriptId,
    similarityToPriorScripts: Math.round(worstSimilarity * 100) / 100,
    similarityToSources: Math.round(maxSourceOverlap * 100) / 100,
  }
}

export async function checkHookRepetition(supabase: SupabaseClient, channelId: string, hook: string, lookback = 30) {
  const { data, error } = await supabase
    .from('yt_scripts')
    .select('hook, yt_topics!inner(channel_id, created_at)')
    .eq('yt_topics.channel_id', channelId)
    .order('created_at', { ascending: false, foreignTable: 'yt_topics' })
    .limit(lookback)
  if (error) throw error

  const newShingles = shingles(hook, 3)
  const repeated = (data ?? []).some((row) => jaccard(newShingles, shingles(row.hook, 3)) > 0.6)
  return { repeated }
}

export async function reviewScriptQuality(
  ai: ScriptAIProvider,
  input: { title: string; fullText: string; scenes: ScriptScene[] }
) {
  const prompt = `Review this YouTube video script as a strict editor. Score 0-10 on: clarity, pacing, factual_grounding,
originality_of_voice, entertainment_or_usefulness_value, cta_strength. List any factual claims that sound
unsupported or exaggerated, and any clickbait/misleading phrasing in the hook or claims. Return ONLY JSON:
{"scores": {"clarity":0,"pacing":0,"factual_grounding":0,"originality_of_voice":0,"entertainment_or_usefulness_value":0,"cta_strength":0},
"overall": 0, "issues": ["..."], "misleading_flag": false, "verdict": "approve|revise|reject"}

Title: ${input.title}
Script: ${input.fullText}`

  const raw = await ai.complete(
    [
      { role: 'system', content: 'You are a strict but fair editorial quality reviewer. Output only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.3, maxTokens: 1200, json: true }
  )

  return JSON.parse(raw.trim().replace(/^```(json)?/i, '').replace(/```$/, '')) as {
    scores: Record<string, number>
    overall: number
    issues: string[]
    misleading_flag: boolean
    verdict: 'approve' | 'revise' | 'reject'
  }
}
