import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { setTelegramWebhook } from '@/lib/channels/telegram'
import { appUrl } from '@/lib/utils'
import type { Channel } from '@/lib/types'

// "Connect" a channel: for Telegram we register our webhook with the Bot API;
// for WhatsApp the webhook is registered on Meta's side, so we just validate the
// credentials are present and mark it connected.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: channel } = await supabase
    .from('channels')
    .select('*')
    .eq('id', params.id)
    .maybeSingle<Channel>()
  if (!channel) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (channel.type === 'telegram') {
    const url = `${appUrl()}/api/webhooks/telegram/${channel.webhook_secret}`
    const result = await setTelegramWebhook(channel, url)
    if (!result?.ok) {
      await supabase.from('channels').update({ status: 'error' }).eq('id', channel.id)
      return NextResponse.json(
        { error: result?.description ?? 'Telegram setWebhook failed' },
        { status: 400 }
      )
    }
  } else if (channel.type === 'whatsapp') {
    const c = channel.credentials ?? {}
    if (!c.access_token || !c.phone_number_id) {
      return NextResponse.json(
        { error: 'WhatsApp needs access_token and phone_number_id.' },
        { status: 400 }
      )
    }
  }

  await supabase.from('channels').update({ status: 'connected' }).eq('id', channel.id)
  return NextResponse.json({ ok: true })
}
