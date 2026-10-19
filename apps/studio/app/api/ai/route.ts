import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import * as z from 'zod/v4'
import { clientKey, rateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL = 'claude-opus-5-5'
const MAX_IMAGE_BYTES = 1_500_000

const Body = z.object({
  mode: z.enum(['photo', 'video']),
  instruction: z.string().trim().min(1).max(1000),
  state: z.record(z.string(), z.unknown()),
  image: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp);base64,/)
    .max(MAX_IMAGE_BYTES * 1.4)
    .optional(),
  duration: z.number().positive().max(36_000).optional(),
})

const n = z.number().nullable()

// Every field is nullable: null means "leave this setting unchanged".
const EditResponse = z.object({
  reply: z.string().describe('One or two friendly sentences telling the user what you changed (or why you could not).'),
  patch: z.object({
    reset: z.boolean().nullable().describe('true to wipe all edits before applying the rest of this patch'),
    adjust: z
      .object({ brightness: n, contrast: n, saturation: n, warmth: n, hue: n, blur: n, vignette: n })
      .nullable(),
    aspect: z.enum(['original', '1:1', '4:5', '9:16', '16:9', '4:3']).nullable(),
    rotate: z.number().nullable().describe('Absolute rotation in degrees: 0, 90, 180 or 270'),
    flipH: z.boolean().nullable(),
    text: z
      .object({
        content: z.string().nullable(),
        position: z.enum(['top', 'center', 'bottom']).nullable(),
        size: z.enum(['small', 'medium', 'large']).nullable(),
        color: z.string().nullable().describe('#rrggbb'),
        remove: z.boolean().nullable(),
      })
      .nullable(),
    trimStart: n,
    trimEnd: n,
    speed: n,
    volume: n,
  }),
})

const SYSTEM = `You are the editing engine inside a photo and video editor. The user describes what they want in plain language; you translate it into a patch of edit settings. You can only change the settings below — you cannot generate, erase or move objects, change faces, remove backgrounds, or add music. If asked for something outside these settings, do the closest thing you can and say plainly what isn't possible yet.

Settings (absolute target values, not deltas):
- adjust.brightness, contrast, saturation, warmth: -100..100 (0 = unchanged). warmth > 0 is warmer/golden, < 0 is cooler/blue.
- adjust.hue: -180..180 degrees. adjust.blur: 0..20. adjust.vignette: 0..100.
- aspect: original | 1:1 (Instagram square) | 4:5 (Instagram portrait) | 9:16 (TikTok, Reels, Shorts, Stories) | 16:9 (YouTube) | 4:3. Crops are centred.
- rotate: 0/90/180/270 absolute clockwise. flipH: mirror horizontally.
- text: caption overlay. Set remove=true to delete it. Keep captions short.
- Video only: trimStart / trimEnd in seconds from the start of the original clip, speed 0.25..4, volume 0..2 (0 mutes).

Rules:
- Set to null every field you are not changing. Never touch video-only fields in photo mode.
- The current settings are given; edits are cumulative, so build on them unless the user asks to start over (then set reset=true).
- When an image is attached, look at it: judge exposure, colour cast and composition before choosing values. Prefer subtle, professional results (most adjustments within ±40) unless the user asks for something strong.
- "Auto enhance" means: fix exposure and colour cast, add a little contrast and saturation if the image is flat, nothing else.`

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'The AI assistant is not configured yet (ANTHROPIC_API_KEY is missing). Manual editing still works.' }, { status: 503 })
  }
  const key = clientKey(req)
  if (!rateLimit(`ai-burst:${key}`, 12, 60_000).ok) return Response.json({ error: 'Too many requests — wait a moment and try again.' }, { status: 429 })
  if (!rateLimit(`ai-day:${key}`, Number(process.env.STUDIO_AI_DAILY_LIMIT ?? 200), 86_400_000).ok) {
    return Response.json({ error: 'Daily AI limit reached. Manual editing still works.' }, { status: 429 })
  }

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 })
  const { mode, instruction, state, image, duration } = parsed.data

  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  if (image) {
    const [, mediaType, data] = image.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/) ?? []
    if (data) {
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp', data } })
    }
  }
  content.push({
    type: 'text',
    text: [
      `Mode: ${mode}`,
      mode === 'video' && duration ? `Clip length: ${duration.toFixed(1)} s${image ? ' (the image is the current frame)' : ''}` : '',
      `Current settings: ${JSON.stringify(state)}`,
      `Request: ${instruction}`,
    ]
      .filter(Boolean)
      .join('\n'),
  })

  try {
    const client = new Anthropic()
    const message = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(EditResponse) },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content }],
    })
    if (message.stop_reason === 'refusal' || !message.parsed_output) {
      return Response.json({ error: 'The assistant could not handle that request. Try rephrasing it.' }, { status: 422 })
    }
    return Response.json(message.parsed_output)
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return Response.json({ error: 'The AI is busy right now — try again in a minute.' }, { status: 429 })
    if (err instanceof Anthropic.APIError) {
      console.error('[ai] API error', err.status, err.message)
      return Response.json({ error: 'The AI assistant had a problem. Please try again.' }, { status: 502 })
    }
    console.error('[ai] unexpected', err)
    return Response.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
