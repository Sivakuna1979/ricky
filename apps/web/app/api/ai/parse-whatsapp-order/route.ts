// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildPrompt(menu: any[]) {
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

export async function POST(req: NextRequest) {
  try {
    const { text, image, van_id } = await req.json()
    if (!van_id) return NextResponse.json({ error: 'van_id required' }, { status: 400 })
    if (!text?.trim() && !image?.data) return NextResponse.json({ error: 'Paste the WhatsApp message or upload a screenshot.' }, { status: 400 })

    // Load this van's menu so the AI can match real items and prices.
    const admin = await createAdminClient()
    const { data: menu } = await admin
      .from('menu_items')
      .select('id, name, price')
      .eq('van_id', van_id)
      .limit(200)

    const prompt = buildPrompt(menu ?? [])
    const content: any[] = []
    if (image?.data && image?.mediaType) {
      content.push({ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } })
    }
    content.push({ type: 'text', text: text?.trim() ? `${prompt}\n\nWhatsApp message:\n${text}` : prompt })

    const message = await callModel(content)
    if (message.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'Could not process that message — try pasting the text instead.' }, { status: 422 })
    }
    const raw = message.content.find((b: any) => b.type === 'text')?.text?.trim() ?? '{}'
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const order = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    if (!order?.items?.length) return NextResponse.json({ error: 'No order items found in that message.' }, { status: 422 })

    // Normalise + total
    order.items = order.items.map((i: any) => ({
      menu_item_id: i.menu_item_id ?? null,
      name: String(i.name ?? 'Item'),
      quantity: Math.max(1, Number(i.quantity) || 1),
      price: Number(i.price) || 0,
    }))
    order.total = order.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0)

    return NextResponse.json({ order })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to read the order' }, { status: 500 })
  }
}
