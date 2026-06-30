import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { parseWhatsappPayload, verifyWhatsappChallenge } from '@/lib/channels/whatsapp'
import { processInbound } from '@/lib/agent/process'
import type { Channel } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function loadChannel(secret: string): Promise<Channel | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('channels')
    .select('*')
    .eq('webhook_secret', secret)
    .eq('type', 'whatsapp')
    .maybeSingle<Channel>()
  return data ?? null
}

// Meta webhook verification handshake (GET).
export async function GET(req: NextRequest, { params }: { params: { secret: string } }) {
  const channel = await loadChannel(params.secret)
  if (!channel) return new NextResponse('not found', { status: 404 })

  const sp = req.nextUrl.searchParams
  const challenge = verifyWhatsappChallenge(
    channel,
    sp.get('hub.mode'),
    sp.get('hub.verify_token'),
    sp.get('hub.challenge')
  )
  if (challenge) return new NextResponse(challenge, { status: 200 })
  return new NextResponse('forbidden', { status: 403 })
}

// Inbound messages (POST).
export async function POST(req: NextRequest, { params }: { params: { secret: string } }) {
  const channel = await loadChannel(params.secret)
  if (!channel) return NextResponse.json({ ok: false }, { status: 404 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  const inbound = await parseWhatsappPayload(channel, body)
  if (inbound?.text || inbound?.mediaUrl) {
    processInbound(channel, inbound).catch((e) => console.error('whatsapp process error', e))
  }

  return NextResponse.json({ ok: true })
}
