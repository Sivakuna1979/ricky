import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getScriptAIProvider, ProviderNotConfiguredError } from '@/lib/providers/factory'
import { detectSensitivity } from '@/lib/pipeline/topics'
import { SCORE_WEIGHTS } from '@/lib/types'

const bodySchema = z.object({ name: z.string().min(2).max(80), description: z.string().max(500).optional() })

// The niche-comparison tool: scores a candidate niche on the 9 dimensions
// the spec calls for (search demand, competition, advertiser suitability,
// production difficulty, evergreen potential, originality potential,
// copyright risk, retention potential, UK/international potential) using
// the user's configured script/research AI, plus a keyword-based sensitive-
// category flag that the UI must surface before it can be activated.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const ai = await getScriptAIProvider(supabase, user.id)
    const prompt = `Score the YouTube content niche "${parsed.data.name}" (${parsed.data.description ?? ''}) on these 9
dimensions, 0-10, where 10 is always the BEST outcome for a small, automated, UK-based channel (so for
"competition", "production_difficulty" and "copyright_risk", 10 means low competition / easy to produce / low risk):
search_demand, competition, advertiser_suitability, production_difficulty, evergreen_potential,
originality_potential, copyright_risk, retention_potential, uk_intl_potential.
Return ONLY JSON: {"scores": {...}, "reasoning": {"search_demand": "...", ...}}`

    const raw = await ai.complete(
      [{ role: 'system', content: 'You are a YouTube channel strategy analyst. Output only valid JSON.' }, { role: 'user', content: prompt }],
      { temperature: 0.4, maxTokens: 1000, json: true }
    )
    const parsedScores = JSON.parse(raw.trim().replace(/^```(json)?/i, '').replace(/```$/, '')) as {
      scores: Record<string, number>
      reasoning: Record<string, string>
    }

    const w = SCORE_WEIGHTS
    const s = parsedScores.scores
    const overall =
      s.search_demand * w.search_demand +
      s.competition * w.competition +
      s.advertiser_suitability * w.advertiser_suitability +
      s.production_difficulty * w.production_difficulty +
      s.evergreen_potential * w.evergreen_potential +
      s.originality_potential * w.originality_potential +
      s.copyright_risk * w.copyright_risk +
      s.retention_potential * w.retention_potential +
      s.uk_intl_potential * w.uk_intl_potential

    const sensitivity = detectSensitivity(`${parsed.data.name} ${parsed.data.description ?? ''}`)

    return NextResponse.json({
      scores: s,
      reasoning: parsedScores.reasoning,
      overallScore: Math.round(overall * 10) / 10,
      isSensitive: sensitivity.sensitive,
      sensitiveCategory: sensitivity.reason ?? null,
    })
  } catch (err) {
    if (err instanceof ProviderNotConfiguredError) return NextResponse.json({ error: err.message }, { status: 412 })
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Scoring failed' }, { status: 500 })
  }
}
