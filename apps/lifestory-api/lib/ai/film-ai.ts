import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import * as z from 'zod/v4'
import type { FilmScript } from '../film/types'

const MODEL = 'claude-opus-5-5'
export const MAX_QUESTIONS = 10

export interface FilmContext {
  subjectName: string
  relation: string | null
  occasion: string
  language: string
  photoCount: number
}

export interface InterviewTurn {
  role: 'assistant' | 'user'
  content: string
}

function client() {
  return new Anthropic()
}

/** Shared request options: server-side fallback if the main model declines. */
const base = () => ({ model: MODEL, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const })

const describe = (c: FilmContext) =>
  `The film is about ${c.subjectName}${c.relation ? ` (${c.relation} of the person making it)` : ''}. Occasion: ${c.occasion}. ` +
  `Language for everything you write: ${c.language}. They have uploaded ${c.photoCount} photos.`

// ------------------------------------------------------------------ interview

const INTERVIEW_SYSTEM = `You interview a family member to gather material for a short documentary film about someone they love. Your questions turn into the film's narration, so you are looking for concrete, vivid detail: places, years, names, small habits, sayings, smells and sounds, turning points, funny stories, what they were proud of, how they loved people.

How to interview:
- Ask ONE question at a time, warm and specific, one or two short sentences. Never a list.
- Build on what they just told you ("You mentioned the shop in Madurai — what was it like inside?").
- Cover the arc of a life over the conversation: roots and childhood, young adulthood, love and family, work, character, later years, what they would want remembered.
- Match the occasion. For a memorial, be gentle and use past tense naturally; never push on painful details. For a birthday or anniversary, be celebratory.
- If an answer is short, that's fine; move on. Never repeat a question.
- Write in the language given. Keep it simple and human; no therapist tone, no praise of their answers.
- When you have enough for a moving 3–5 minute film (usually after 6–10 answers), set done to true and use "question" for a short thank-you that says the script comes next.`

const InterviewStep = z.object({
  question: z.string().describe('The next question, or a closing thank-you when done'),
  done: z.boolean(),
})

export async function nextInterviewStep(ctx: FilmContext, history: InterviewTurn[]) {
  const answers = history.filter((t) => t.role === 'user').length
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: 'user', content: `${describe(ctx)}\n\nStart the interview with your first question.` },
    ...history.map((t) => ({ role: t.role, content: t.content })),
  ]
  if (messages[messages.length - 1].role === 'assistant') throw new Error('Waiting for an answer')
  if (answers >= MAX_QUESTIONS) {
    messages.push({ role: 'user', content: '[That is the last answer. Set done to true and thank them.]' })
  }
  const res = await client().beta.messages.parse({
    ...base(),
    max_tokens: 2000,
    output_config: { effort: 'low', format: betaZodOutputFormat(InterviewStep) },
    system: [{ type: 'text', text: INTERVIEW_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: mergeConsecutive(messages),
  })
  if (res.stop_reason === 'refusal' || !res.parsed_output) throw new Error('The interviewer could not continue. Please try again.')
  return { ...res.parsed_output, done: res.parsed_output.done || answers >= MAX_QUESTIONS }
}

/** The API needs alternating roles; join any back-to-back user turns. */
function mergeConsecutive(msgs: Anthropic.Beta.BetaMessageParam[]): Anthropic.Beta.BetaMessageParam[] {
  const out: Anthropic.Beta.BetaMessageParam[] = []
  for (const m of msgs) {
    const prev = out[out.length - 1]
    if (prev && prev.role === m.role && typeof prev.content === 'string' && typeof m.content === 'string') prev.content += `\n\n${m.content}`
    else out.push({ ...m })
  }
  return out
}

// ------------------------------------------------------------------ script

const SCRIPT_SYSTEM = `You write the narration for a short documentary film about a person's life, made by their family from old photos and an interview. It will be read aloud by a narrator over the photos, with soft music, at a family gathering. Your job is to make the room smile and cry.

Rules:
- Use ONLY facts from the interview and photo notes. Never invent names, places, dates, jobs or events. You may describe what is plainly visible in a photo ("a young woman laughing on a beach") but not guess who people are or when it was unless you were told.
- Tell the life roughly in order, as 6–12 scenes. Each scene has 1–4 photos and 2–4 spoken sentences (about 25–60 words). Total narration around 350–650 words.
- Use every photo exactly once, choosing the photos that fit each moment. Put clearly older photos earlier.
- Write for the ear: short sentences, concrete detail, the person's own sayings in quotes if given. Third person ("She…"), warm, never flowery or cliché ("a journey", "touched so many lives"). One light, funny moment is good.
- Match the occasion: memorial = loving remembrance; birthday/anniversary/retirement = celebration, present tense where right.
- caption: optional short on-screen label (place and/or year, or a few words), null if nothing is known. Max 40 characters.
- title: usually the name they were called by family. subtitle: years of life if known, otherwise a short phrase. closing: one short line for the end card (e.g. "With love, from all of us").
- Write everything in the language given.`

const Script = z.object({
  title: z.string(),
  subtitle: z.string(),
  scenes: z.array(z.object({ photoIds: z.array(z.string()), narration: z.string(), caption: z.string().nullable() })),
  closing: z.string(),
  musicMood: z.enum(['gentle', 'uplifting', 'nostalgic']),
})

export interface ScriptPhoto {
  id: string
  jpegBase64: string // small thumbnail
  note: string | null
}

export async function writeScript(ctx: FilmContext, interview: InterviewTurn[], photos: ScriptPhoto[]): Promise<FilmScript> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [{ type: 'text', text: `${describe(ctx)}\n\nThe photos follow. Refer to them by id.` }]
  for (const p of photos) {
    content.push({ type: 'text', text: `Photo id: ${p.id}${p.note ? ` — note from family: ${p.note}` : ''}` })
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p.jpegBase64 } })
  }
  const transcript = interview.map((t) => `${t.role === 'assistant' ? 'Interviewer' : 'Family'}: ${t.content}`).join('\n')
  content.push({ type: 'text', text: `Interview transcript:\n${transcript}\n\nWrite the film script.` })

  const stream = client().beta.messages.stream({
    ...base(),
    max_tokens: 32000,
    output_config: { effort: 'high', format: betaZodOutputFormat(Script) },
    system: [{ type: 'text', text: SCRIPT_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
  })
  const res = await stream.finalMessage()
  if (res.stop_reason === 'refusal') throw new Error('The script writer could not handle this film. Please try again.')
  const text = res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text
  if (!text) throw new Error('The script writer returned nothing. Please try again.')
  const parsed = Script.safeParse(JSON.parse(text))
  if (!parsed.success) throw new Error('The script came back in the wrong shape. Please try again.')
  return fixPhotoUse(parsed.data, photos.map((p) => p.id))
}

/** Make sure every uploaded photo appears exactly once and no unknown ids slip through. */
export function fixPhotoUse(script: FilmScript, photoIds: string[]): FilmScript {
  const known = new Set(photoIds)
  const used = new Set<string>()
  const scenes = script.scenes
    .map((s) => ({
      ...s,
      caption: s.caption?.trim() ? s.caption.trim().slice(0, 60) : null,
      photoIds: s.photoIds.filter((id) => known.has(id) && !used.has(id) && used.add(id)),
    }))
    .filter((s) => s.narration.trim() || s.photoIds.length)
  const missing = photoIds.filter((id) => !used.has(id))
  // Spread forgotten photos across the scenes with the fewest photos.
  for (const id of missing) {
    const target = scenes.reduce((a, b) => (b.photoIds.length < a.photoIds.length ? b : a), scenes[scenes.length - 1])
    target?.photoIds.push(id)
  }
  return { ...script, scenes }
}
