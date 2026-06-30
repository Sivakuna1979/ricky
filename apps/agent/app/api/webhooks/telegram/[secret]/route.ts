import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { parseTelegramUpdate } from '@/lib/channels/telegram'
import { processInbound } from '@/lib/agent/process'
import type { Channel } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Telegram delivers updates here. The per-channel secret namespaces the URL so
// each customer's bot has its own unguessable endpoint.
export async function POST(req: NextRequest, { params }: { params: { secret: string } }) {
  const supabase = createAdminClient()
  const { data: channel } = await supabase
    .from('channels')
    .select('*')
    .eq('webhook_secret', params.secret)
    .eq('type', 'telegram')
    .maybeSingle<Channel>()

  if (!channel) return NextResponse.json({ ok: false }, { status: 404 })

  const update = await req.json().catch(() => null)
  if (!update) return NextResponse.json({ ok: true })

  const inbound = await parseTelegramUpdate(channel, update)
  if (inbound?.text || inbound?.mediaUrl) {
    // Process asynchronously so Telegram gets a fast 200 and won't retry.
    processInbound(channel, inbound).catch((e) => console.error('telegram process error', e))
  }

  return NextResponse.json({ ok: true })
}
