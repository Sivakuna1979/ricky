import type { Channel, InboundMessage } from '@/lib/types'

const TELEGRAM_API = 'https://api.telegram.org'

// Telegram bot credentials live in channel.credentials.bot_token.
function token(channel: Channel): string {
  const t = channel.credentials?.bot_token
  if (!t) throw new Error('Telegram channel is missing bot_token')
  return t
}

// Parse an inbound Telegram webhook update into our channel-agnostic shape.
export async function parseTelegramUpdate(
  channel: Channel,
  update: any
): Promise<InboundMessage | null> {
  const msg = update?.message ?? update?.edited_message
  if (!msg) return null

  const from = msg.chat?.id ?? msg.from?.id
  if (from == null) return null

  const fromName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') ||
    msg.from?.username

  // Voice / audio note.
  if (msg.voice || msg.audio) {
    const fileId = (msg.voice ?? msg.audio).file_id
    const mediaUrl = await getFileUrl(channel, fileId)
    return {
      channelType: 'telegram',
      fromExternalId: String(from),
      fromName,
      text: msg.caption,
      mediaUrl,
      mediaType: 'audio',
      raw: update,
    }
  }

  // Photo.
  if (msg.photo?.length) {
    const largest = msg.photo[msg.photo.length - 1]
    const mediaUrl = await getFileUrl(channel, largest.file_id)
    return {
      channelType: 'telegram',
      fromExternalId: String(from),
      fromName,
      text: msg.caption,
      mediaUrl,
      mediaType: 'image',
      raw: update,
    }
  }

  return {
    channelType: 'telegram',
    fromExternalId: String(from),
    fromName,
    text: msg.text,
    raw: update,
  }
}

// Resolve a Telegram file_id into a temporary download URL.
async function getFileUrl(channel: Channel, fileId: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token(channel)}/getFile?file_id=${fileId}`)
    const data = await res.json()
    const path = data?.result?.file_path
    if (!path) return undefined
    return `${TELEGRAM_API}/file/bot${token(channel)}/${path}`
  } catch {
    return undefined
  }
}

export async function sendTelegramText(channel: Channel, chatId: string, text: string) {
  await fetch(`${TELEGRAM_API}/bot${token(channel)}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  })
}

export async function sendTelegramPhoto(channel: Channel, chatId: string, photoUrl: string, caption?: string) {
  await fetch(`${TELEGRAM_API}/bot${token(channel)}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption }),
  })
}

export async function sendTelegramVoice(channel: Channel, chatId: string, voiceUrl: string) {
  await fetch(`${TELEGRAM_API}/bot${token(channel)}/sendVoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, voice: voiceUrl }),
  })
}

// Register the webhook URL with Telegram so updates are delivered to us.
export async function setTelegramWebhook(channel: Channel, url: string) {
  const res = await fetch(`${TELEGRAM_API}/bot${token(channel)}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, allowed_updates: ['message', 'edited_message'] }),
  })
  return res.json()
}
