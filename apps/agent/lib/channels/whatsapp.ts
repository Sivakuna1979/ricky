import type { Channel, InboundMessage } from '@/lib/types'

// WhatsApp Cloud API (Meta Graph API).
// channel.credentials holds:
//   access_token   – permanent / system-user token
//   phone_number_id – WA business phone number id
//   verify_token   – string used during webhook verification handshake
const GRAPH = 'https://graph.facebook.com/v20.0'

function creds(channel: Channel) {
  const c = channel.credentials ?? {}
  if (!c.access_token || !c.phone_number_id) {
    throw new Error('WhatsApp channel is missing access_token / phone_number_id')
  }
  return c as { access_token: string; phone_number_id: string; verify_token?: string }
}

// GET handshake Meta performs when you register the webhook.
export function verifyWhatsappChallenge(
  channel: Channel,
  mode: string | null,
  verifyToken: string | null,
  challenge: string | null
): string | null {
  const expected = channel.credentials?.verify_token
  if (mode === 'subscribe' && verifyToken && verifyToken === expected) {
    return challenge
  }
  return null
}

// Parse an inbound WhatsApp webhook payload into our channel-agnostic shape.
export async function parseWhatsappPayload(
  channel: Channel,
  body: any
): Promise<InboundMessage | null> {
  try {
    const value = body?.entry?.[0]?.changes?.[0]?.value
    const message = value?.messages?.[0]
    if (!message) return null

    const from = message.from // E.164 phone, no +
    const profileName = value?.contacts?.[0]?.profile?.name

    if (message.type === 'text') {
      return {
        channelType: 'whatsapp',
        fromExternalId: from,
        fromName: profileName,
        text: message.text?.body,
        raw: body,
      }
    }

    if (message.type === 'audio' || message.type === 'voice') {
      const mediaUrl = await getMediaUrl(channel, message.audio?.id ?? message.voice?.id)
      return {
        channelType: 'whatsapp',
        fromExternalId: from,
        fromName: profileName,
        mediaUrl,
        mediaType: 'audio',
        raw: body,
      }
    }

    if (message.type === 'image') {
      const mediaUrl = await getMediaUrl(channel, message.image?.id)
      return {
        channelType: 'whatsapp',
        fromExternalId: from,
        fromName: profileName,
        text: message.image?.caption,
        mediaUrl,
        mediaType: 'image',
        raw: body,
      }
    }

    return { channelType: 'whatsapp', fromExternalId: from, fromName: profileName, raw: body }
  } catch {
    return null
  }
}

// Resolve a WhatsApp media id to a temporary, authenticated download URL.
// The returned URL still requires the Bearer token to fetch the bytes.
export async function getMediaUrl(channel: Channel, mediaId?: string): Promise<string | undefined> {
  if (!mediaId) return undefined
  const c = creds(channel)
  const res = await fetch(`${GRAPH}/${mediaId}`, {
    headers: { Authorization: `Bearer ${c.access_token}` },
  })
  const data = await res.json()
  return data?.url
}

// Download media bytes (Cloud API media URLs require the access token).
export async function downloadWhatsappMedia(channel: Channel, url: string): Promise<ArrayBuffer> {
  const c = creds(channel)
  const res = await fetch(url, { headers: { Authorization: `Bearer ${c.access_token}` } })
  return res.arrayBuffer()
}

export async function sendWhatsappText(channel: Channel, to: string, text: string) {
  const c = creds(channel)
  await fetch(`${GRAPH}/${c.phone_number_id}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  })
}

export async function sendWhatsappImage(channel: Channel, to: string, imageUrl: string, caption?: string) {
  const c = creds(channel)
  await fetch(`${GRAPH}/${c.phone_number_id}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: { link: imageUrl, caption },
    }),
  })
}
