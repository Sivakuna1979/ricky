import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { getViewer, viewerKey } from '@/lib/auth/viewer'
import { hasFeature, LIMITS } from '@/lib/plans'
import { clientKey, rateLimit } from '@/lib/security/rate-limit'
import { buildContext, detectTickers, loadSubjects } from '@/lib/ai/context'
import { fallbackAnswer } from '@/lib/ai/fallback'
import { RESEARCH_SYSTEM_PROMPT } from '@/lib/ai/prompt'
import { getUniverse } from '@/lib/screener/universe'
import { normaliseTicker } from '@/lib/data/dataset'

export const runtime = 'nodejs'
export const maxDuration = 120

const Body = z.object({
  question: z.string().trim().min(2).max(1000),
  tickers: z.array(z.string().max(12)).max(5).optional(),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) }))
    .max(12)
    .optional(),
})

const MODEL = 'claude-opus-5-5'

function textStream(write: (push: (s: string) => void) => Promise<void>) {
  const enc = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await write((s) => controller.enqueue(enc.encode(s)))
      } finally {
        controller.close()
      }
    },
  })
}

export async function POST(req: Request) {
  const viewer = await getViewer()
  if (!hasFeature(viewer.plan, 'ai')) return Response.json({ error: 'The AI research assistant is available on Premium and Professional plans.' }, { status: 403 })
  const quota = rateLimit(`ai:${viewerKey(viewer, clientKey(req))}`, LIMITS[viewer.plan].aiQueriesPerDay, 86_400_000)
  if (!quota.ok) return Response.json({ error: 'Daily AI question limit reached for your plan.' }, { status: 429 })
  const burst = rateLimit(`ai-burst:${clientKey(req)}`, 10, 60_000)
  if (!burst.ok) return Response.json({ error: 'Too many requests — slow down a little.' }, { status: 429 })

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 })
  const { question, history = [] } = parsed.data

  const known = getUniverse().map((u) => u.ticker)
  const explicit = (parsed.data.tickers ?? []).map(normaliseTicker).filter((t): t is string => Boolean(t))
  const tickers = [...new Set([...explicit, ...detectTickers(question, known)])].slice(0, 5)
  const subjects = await loadSubjects(tickers)

  const useModel = Boolean(process.env.ANTHROPIC_API_KEY)
  const headers = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Answer-Source': useModel ? 'claude' : 'rules', 'X-Subjects': tickers.join(',') }

  if (!useModel || subjects.length === 0) {
    return new Response(textStream(async (push) => push(fallbackAnswer(question, subjects))), { headers: { ...headers, 'X-Answer-Source': 'rules' } })
  }

  const client = new Anthropic()
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: 'user', content: `Company data (JSON; the only permitted source of figures):\n${buildContext(subjects)}` },
    { role: 'assistant', content: 'Understood. I will answer only from this data and label forward-looking statements.' },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: question },
  ]

  return new Response(
    textStream(async (push) => {
      try {
        const stream = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'medium' },
          system: [{ type: 'text', text: RESEARCH_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages,
        })
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') push(event.delta.text)
        }
        const final = await stream.finalMessage()
        if (final.stop_reason === 'refusal') push('\n\n_The model declined to answer this request. Try rephrasing the question around the company’s data._')
        if (final.stop_reason === 'max_tokens') push('\n\n_(Answer truncated.)_')
      } catch (err) {
        const reason =
          err instanceof Anthropic.RateLimitError ? 'the AI service is rate-limited' : err instanceof Anthropic.AuthenticationError ? 'the AI service credentials are invalid' : err instanceof Anthropic.APIError ? `the AI service returned ${err.status}` : 'the AI service is unreachable'
        push(`_Note: ${reason}; showing the rules-based answer instead._\n\n${fallbackAnswer(question, subjects)}`)
      }
    }),
    { headers },
  )
}
