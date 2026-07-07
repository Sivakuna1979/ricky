// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/server'

// ============================================================================
// WhatsApp Cloud API webhook — fully automatic ordering, MULTI-TENANT.
// One shared webhook for every business on FoodTaxi. Incoming messages are
// routed by the phone_number_id they were sent to (whatsapp_channels table),
// and replies are sent with that business's own access token.
//
// Global env vars (platform level):
//   WHATSAPP_VERIFY_TOKEN    shared verify token every business enters in Meta
// Legacy single-tenant fallback (kept so existing setups keep working):
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VAN_ID
// ============================================================================

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Meta webhook verification handshake
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  if (p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(p.get('hub.challenge') ?? '', { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// channel = { phone_number_id, access_token, van_id }
async function sendWhatsApp(channel: any, to: string, body: string) {
  const token = channel?.access_token ?? process.env.WHATSAPP_TOKEN
  const phoneId = channel?.phone_number_id ?? process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneId) return
  await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
  }).catch(() => {})
}

// Find which business/van owns the number this message was sent TO.
async function resolveChannel(admin: any, phoneNumberId: string) {
  if (phoneNumberId) {
    const { data } = await admin
      .from('whatsapp_channels')
      .select('phone_number_id, access_token, van_id')
      .eq('phone_number_id', phoneNumberId)
      .eq('is_active', true)
      .maybeSingle()
    if (data) return data
  }
  // Legacy env-var fallback (single-tenant installs / the platform test number)
  if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return {
      phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID,
      access_token: process.env.WHATSAPP_TOKEN,
      van_id: process.env.WHATSAPP_VAN_ID ?? null,
    }
  }
  return null
}

function parsePrompt(menu: any[]) {
  return `You are taking a WhatsApp order for a food van. Menu (id | name | price):
${menu.map(m => `${m.id} | ${m.name} | £${Number(m.price).toFixed(2)}`).join('\n')}

Return ONLY valid JSON:
{"items":[{"menu_item_id":"...or null","name":"...","quantity":1,"price":0.0}],"pickup_location":"","pickup_time":"","notes":""}
Rules: match items to the menu (use its id/name/price); unknown items get menu_item_id null and price 0;
"two cod" means quantity 2; keep special requests in notes.
If the message is NOT a food order (a question, greeting, etc) return {"items":[]}.`
}

export async function POST(req: NextRequest) {
  // Always 200 fast — Meta retries aggressively on non-200.
  try {
    const payload = await req.json()
    const admin = await createAdminClient()

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const phoneNumberId = change.value?.metadata?.phone_number_id ?? ''
        for (const msg of change.value?.messages ?? []) {
          const channel = await resolveChannel(admin, phoneNumberId)
          if (!channel) continue // number not registered with any business

          if (msg.type !== 'text') {
            if (msg.from) await sendWhatsApp(channel, msg.from, 'Thanks! Please send your order as a text message, e.g. "2 cod and chips, pickup at 7pm" 🍟')
            continue
          }

          // Dedupe — Meta redelivers
          const { error: dupErr } = await admin.from('whatsapp_messages').insert({ id: msg.id, from_phone: msg.from, body: msg.text.body })
          if (dupErr) continue // already processed (or table missing — fail safe, no double orders)

          const profileName = change.value?.contacts?.[0]?.profile?.name ?? ''
          await handleOrder(admin, channel, msg, profileName)
        }
      }
    }
  } catch { /* swallow — must still 200 */ }
  return NextResponse.json({ ok: true })
}

async function handleOrder(admin: any, channel: any, msg: any, profileName: string) {
  const from = msg.from
  const text = msg.text.body
  try {
    // Which van takes this channel's orders
    let van: any = null
    if (channel.van_id) {
      const { data } = await admin.from('vans').select('id, name, business_id').eq('id', channel.van_id).single()
      van = data
    } else {
      const { data } = await admin.from('vans').select('id, name, business_id').eq('is_active', true).limit(1).single()
      van = data
    }
    if (!van) return
    const vanId = van.id

    const { data: menu } = await admin.from('menu_items').select('id, name, price').eq('van_id', vanId).limit(200)

    let message
    try {
      message = await client.beta.messages.create({
        model: 'claude-fable-5',
        max_tokens: 1536,
        messages: [{ role: 'user', content: `${parsePrompt(menu ?? [])}\n\nWhatsApp message from ${profileName || 'customer'}:\n${text}` }],
        betas: ['server-side-fallback-2026-06-01'],
        fallbacks: [{ model: 'claude-opus-4-8' }],
      })
    } catch {
      message = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1536,
        messages: [{ role: 'user', content: `${parsePrompt(menu ?? [])}\n\nWhatsApp message from ${profileName || 'customer'}:\n${text}` }],
      })
    }

    const raw = message.content?.find((b: any) => b.type === 'text')?.text?.trim() ?? '{}'
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}')

    if (!parsed.items?.length) {
      await admin.from('whatsapp_messages').update({ outcome: 'no_items' }).eq('id', msg.id)
      await sendWhatsApp(channel, from, `Hi${profileName ? ` ${profileName.split(' ')[0]}` : ''}! Thanks for your message — ${van.name ?? 'the van'} will get back to you shortly. To order instantly, just text what you'd like, e.g. "2 cod and chips" 🍟`)
      return
    }

    const items = parsed.items.map((i: any) => ({
      menu_item_id: i.menu_item_id ?? null,
      name: String(i.name ?? 'Item'),
      quantity: Math.max(1, Number(i.quantity) || 1),
      price: Number(i.price) || 0,
    }))
    const total = items.reduce((s: number, i: any) => s + i.price * i.quantity, 0)
    const order_number = 'FT' + Date.now().toString().slice(-6)

    const { data: order, error } = await admin.from('orders').insert({
      van_id: vanId,
      guest_name: profileName || 'WhatsApp customer',
      guest_phone: `+${from}`,
      notes: `[WhatsApp auto-order]${parsed.notes ? ' ' + parsed.notes : ''}`,
      pickup_location: parsed.pickup_location || null,
      pickup_time: parsed.pickup_time || null,
      subtotal: total,
      total,
      payment_method: 'cash_at_van',
      status: 'pending',
      order_number,
    }).select('id').single()
    if (error) throw new Error(error.message)

    await admin.from('order_items').insert(items.map((i: any) => ({
      order_id: order.id, menu_item_id: i.menu_item_id, name: i.name, price: i.price, quantity: i.quantity, item_total: i.price * i.quantity,
    })))

    await admin.from('whatsapp_messages').update({ outcome: 'ordered', order_id: order.id }).eq('id', msg.id)

    const summary = items.map((i: any) => `• ${i.quantity}x ${i.name} — £${(i.price * i.quantity).toFixed(2)}`).join('\n')
    await sendWhatsApp(channel, from,
      `✅ Order received${profileName ? `, ${profileName.split(' ')[0]}` : ''}!\n\n${summary}\nTotal: £${total.toFixed(2)}\n\nOrder ref: #${order_number}\n${parsed.pickup_location ? `Pickup: ${parsed.pickup_location}${parsed.pickup_time ? ` ~${parsed.pickup_time}` : ''}\n` : ''}Pay cash or card at the van. We'll message you when it's ready! 🍟`)
  } catch (e: any) {
    await admin.from('whatsapp_messages').update({ outcome: `error: ${e.message}`.slice(0, 200) }).eq('id', msg.id).catch(() => {})
    await sendWhatsApp(channel, from, 'Sorry, something went wrong taking your order automatically — the van will reply personally shortly!')
  }
}
