import type { Channel } from '@/lib/types'
import { sendTelegramText, sendTelegramPhoto } from './telegram'
import { sendWhatsappText, sendWhatsappImage } from './whatsapp'

// Channel-agnostic outbound dispatch. The rest of the app talks to these
// functions and never needs to know which messaging provider is behind a channel.

export async function sendText(channel: Channel, to: string, text: string) {
  if (channel.type === 'telegram') return sendTelegramText(channel, to, text)
  if (channel.type === 'whatsapp') return sendWhatsappText(channel, to, text)
  throw new Error(`Unknown channel type: ${channel.type}`)
}

export async function sendImage(channel: Channel, to: string, imageUrl: string, caption?: string) {
  if (channel.type === 'telegram') return sendTelegramPhoto(channel, to, imageUrl, caption)
  if (channel.type === 'whatsapp') return sendWhatsappImage(channel, to, imageUrl, caption)
  throw new Error(`Unknown channel type: ${channel.type}`)
}

export * from './telegram'
export * from './whatsapp'
