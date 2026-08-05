import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { listConfiguredProviders, saveProviderCredential } from '@/lib/credentials'

const PROVIDER_TYPES = [
  'script_ai', 'research', 'tts', 'image_gen', 'stock_video', 'stock_image', 'music', 'youtube_oauth', 'email', 'moderation',
] as const

const bodySchema = z.object({
  providerType: z.enum(PROVIDER_TYPES),
  providerName: z.string().min(1).max(60),
  apiKey: z.string().min(1),
  baseUrl: z.string().url().optional(),
  model: z.string().max(100).optional(),
  voiceId: z.string().max(100).optional(),
})

// GET returns which providers are configured (never the key itself — keys
// are AES-256-GCM encrypted at rest and only decrypted server-side inside
// the worker when a pipeline stage actually needs to call the vendor).
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const providers = await listConfiguredProviders(supabase, user.id)
  return NextResponse.json({ providers })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { providerType, providerName, ...secret } = parsed.data

  try {
    await saveProviderCredential(supabase, user.id, providerType, providerName, secret)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to save credential' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
