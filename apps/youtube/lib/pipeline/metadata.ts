import type { ScriptAIProvider } from '@/lib/providers/types'
import type { Chapter, ScriptScene, VideoKind } from '@/lib/types'

export interface GeneratedMetadata {
  title: string
  description: string
  tags: string[]
  hashtags: string[]
  chapters: Chapter[]
  pinnedComment: string
}

const AI_DISCLOSURE_TEXT =
  '\n\nThis video uses an AI-generated voice-over and AI-assisted visuals as part of its production. ' +
  'All factual claims are sourced — see below.'

export async function generateMetadata(
  ai: ScriptAIProvider,
  input: {
    workingTitle: string
    fullScript: string
    scenes: ScriptScene[]
    videoKind: VideoKind
    sources: Array<{ url: string; title: string }>
  }
): Promise<GeneratedMetadata> {
  const prompt = `Generate YouTube metadata for this video. The title must be accurate (no clickbait/false claims) and
under 100 characters. Description should be 2-4 short paragraphs, natural, not stuffed with keywords, and must NOT
make promises the video doesn't keep. Suggest 8-15 tags, 3-5 hashtags (with #), and (for long-form only) chapter
markers aligned to the scene timestamps below. Also write one short, genuinely useful pinned comment (e.g. a
follow-up question or the single most useful takeaway) — not engagement bait like "comment YES if...".

Return ONLY JSON: {"title": "...", "description": "...", "tags": ["..."], "hashtags": ["..."], "chapters": [{"time_seconds":0,"title":"..."}], "pinned_comment": "..."}

Working title: ${input.workingTitle}
Video kind: ${input.videoKind}
Scenes (index, cumulative start seconds, text): ${input.scenes
    .reduce<{ list: string[]; t: number }>(
      (acc, s) => {
        acc.list.push(`${s.index} @${Math.round(acc.t)}s: ${s.text.slice(0, 80)}`)
        acc.t += s.duration_seconds
        return acc
      },
      { list: [], t: 0 }
    )
    .list.join('\n')}
Full script: ${input.fullScript}`

  const raw = await ai.complete(
    [{ role: 'system', content: 'You are a YouTube SEO and metadata specialist who never writes misleading copy. Output only valid JSON.' }, { role: 'user', content: prompt }],
    { temperature: 0.6, maxTokens: 1500, json: true }
  )

  const parsed = JSON.parse(raw.trim().replace(/^```(json)?/i, '').replace(/```$/, '')) as GeneratedMetadata

  const sourcesBlock = input.sources.length
    ? '\n\nSources:\n' + input.sources.map((s) => `- ${s.title}: ${s.url}`).join('\n')
    : ''

  return {
    ...parsed,
    description: `${parsed.description}${AI_DISCLOSURE_TEXT}${sourcesBlock}`,
    chapters: input.videoKind === 'long' ? parsed.chapters : [],
  }
}
