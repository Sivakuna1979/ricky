// @ts-nocheck
// Extracted from app/api/ai/parse-whatsapp-order/route.ts (byte-for-byte
// the same prompt/call/parse logic, just made importable) so the Phase B
// eval harness (scripts/eval-whatsapp-parser.ts) exercises the exact code
// path production uses, instead of a second hand-written reimplementation
// that could silently drift from it.
import Anthropic from '@anthropic-ai/sdk'
import { withAiUsageLog } from './usageLog'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type MenuItemForPrompt = { id: string; name: string; price: number }

export function buildWhatsAppOrderPrompt(menu: MenuItemForPrompt[]) {
  return `You are reading a WhatsApp order sent to a food van. Extract the order.
Here is the van's menu (id | name | price):
${menu.map(m => `${m.id} | ${m.name} | £${Number(m.price).toFixed(2)}`).join('\n')}

Return ONLY a valid JSON object, no other text, no markdown:
{
  "customer_name": "..." or "",
  "customer_phone": "..." or "",
  "pickup_location": "..." or "",
  "pickup_time": "..." or "",
  "notes": "..." or "",
  "items": [
    { "menu_item_id": "id from menu or null", "name": "...", "quantity": 1, "price": 0.00 }
  ]
}
Rules:
- Match each requested item to the closest menu item (use its id, exact name and price).
- If something isn't on the menu, keep it with menu_item_id null, price 0.
- quantity defaults to 1. Convert "two cod" -> quantity 2.
- customer details only if present in the message/screenshot (WhatsApp sender name counts).
- Keep notes for special requests ("no salt", "extra vinegar").`
}

async function callModel(content: any[]) {
  // Claude Fable 5 (thinking always on) with server-side fallback to Opus 4.8.
  try {
    return await client.beta.messages.create({
      model: 'claude-fable-5',
      max_tokens: 2048,
      messages: [{ role: 'user', content }],
      betas: ['server-side-fallback-2026-06-01'],
      fallbacks: [{ model: 'claude-opus-4-8' }],
    })
  } catch {
    // Older SDK or beta unavailable — plain Opus call keeps the feature working.
    return await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      messages: [{ role: 'user', content }],
    })
  }
}

export type ParsedWhatsAppOrderItem = { menu_item_id: string | null; name: string; quantity: number; price: number }
export type ParsedWhatsAppOrder = {
  customer_name: string
  customer_phone: string
  pickup_location: string
  pickup_time: string
  notes: string
  items: ParsedWhatsAppOrderItem[]
  total: number
}

export type ParseWhatsAppOrderResult =
  | { ok: true; order: ParsedWhatsAppOrder }
  | { ok: false; reason: 'refusal' | 'no_items' }

export async function parseWhatsAppOrderMessage(params: {
  menu: MenuItemForPrompt[]
  text?: string | null
  image?: { data: string; mediaType: string } | null
}): Promise<ParseWhatsAppOrderResult> {
  const prompt = buildWhatsAppOrderPrompt(params.menu)
  const content: any[] = []
  if (params.image?.data && params.image?.mediaType) {
    content.push({ type: 'image', source: { type: 'base64', media_type: params.image.mediaType, data: params.image.data } })
  }
  content.push({ type: 'text', text: params.text?.trim() ? `${prompt}\n\nWhatsApp message:\n${params.text}` : prompt })

  const message = await withAiUsageLog(
    { feature: 'whatsapp_order_parse', requestedModel: 'claude-fable-5' },
    () => callModel(content)
  )
  if (message.stop_reason === 'refusal') {
    return { ok: false, reason: 'refusal' }
  }
  const raw = message.content.find((b: any) => b.type === 'text')?.text?.trim() ?? '{}'
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  const order = jsonMatch ? JSON.parse(jsonMatch[0]) : null
  if (!order?.items?.length) return { ok: false, reason: 'no_items' }

  order.items = order.items.map((i: any) => ({
    menu_item_id: i.menu_item_id ?? null,
    name: String(i.name ?? 'Item'),
    quantity: Math.max(1, Number(i.quantity) || 1),
    price: Number(i.price) || 0,
  }))
  order.total = order.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0)

  return { ok: true, order }
}
