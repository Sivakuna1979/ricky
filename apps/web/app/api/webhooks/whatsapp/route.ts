// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/server'

// ============================================================================
// WhatsApp Cloud API webhook — fully automatic ordering, MULTI-TENANT and
// CONVERSATIONAL. If a customer's order is missing pickup details, Claude
// asks ONE simple follow-up (listing today's actual stops); their reply is
// attached to the same order instead of creating a new one.
//
// Global env vars: WHATSAPP_VERIFY_TOKEN
// Legacy single-tenant fallback: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
// WHATSAPP_VAN_ID
// ============================================================================

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  if (p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(p.get('hub.challenge') ?? '', { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

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
  if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return {
      phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID,
      access_token: process.env.WHATSAPP_TOKEN,
      van_id: process.env.WHATSAPP_VAN_ID ?? null,
    }
  }
  return null
}

function buildPrompt({ menu, stops, pendingOrder, profileName, text }: any) {
  const stopsList = stops.length
    ? stops.map((s: any) => `- ${s.location_name} (${s.arrival_time}–${s.departure_time})`).join('\n')
    : '(no stops scheduled today)'
  const pendingBit = pendingOrder
    ? `\nIMPORTANT CONTEXT: this customer has an open order #${pendingOrder.order_number} (£${Number(pendingOrder.total).toFixed(2)}) that is still missing ${!pendingOrder.pickup_location ? 'a pickup stop' : ''}${!pendingOrder.pickup_location && !pendingOrder.pickup_time ? ' and ' : ''}${!pendingOrder.pickup_time ? 'a pickup time' : ''}. If this message provides those details (a stop name and/or a time), use action "pickup_details".`
    : ''
  return `You are the WhatsApp assistant for a food van. Today's stops:
${stopsList}

Menu (id | name | price):
${menu.map((m: any) => `${m.id} | ${m.name} | £${Number(m.price).toFixed(2)}`).join('\n')}
${pendingBit}

Return ONLY valid JSON:
{
  "action": "order" | "pickup_details" | "chat",
  "items": [{"menu_item_id":"...or null","name":"...","quantity":1,"price":0.0}],
  "pickup_location": "",   // match to one of today's stop names when possible
  "pickup_time": "",       // e.g. "18:30" or "around 7pm"
  "notes": ""
}
Rules:
- action "order": the message contains food items to order. Match items to the menu (use its id/name/price); unknown items get menu_item_id null and price 0; "two cod" means quantity 2.
- action "pickup_details": no new food items, but the message gives a stop and/or time for the open order (e.g. "Tesco's at 7", "the 6:30 one", "Link Lane").
- action "chat": anything else (greeting, question).
- If the customer names a place, match it to the closest of today's stops and put that exact stop name in pickup_location.
- Keep special requests in notes.

WhatsApp message from ${profileName || 'customer'}:
${text}`
}

async function askClaude(prompt: string) {
  let message
  try {
    message = await client.beta.messages.create({
      model: 'claude-fable-5',
      max_tokens: 1536,
      messages: [{ role: 'user', content: prompt }],
      betas: ['server-side-fallback-2026-06-01'],
      fallbacks: [{ model: 'claude-opus-4-8' }],
    })
  } catch {
    message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1536,
      messages: [{ role: 'user', content: prompt }],
    })
  }
  const raw = message.content?.find((b: any) => b.type === 'text')?.text?.trim() ?? '{}'
  return JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
}

// One short question, never an interrogation.
function pickupQuestion(stops: any[], missing: 'both' | 'location' | 'time') {
  if (missing !== 'time' && stops.length) {
    const list = stops.map((s: any) => `📍 ${s.location_name} (${s.arrival_time}–${s.departure_time})`).join('\n')
    return `One last thing — where would you like to collect? Today we're at:\n${list}\nJust reply with the stop${missing === 'both' ? ' and a rough time' : ''} 😊`
  }
  return `One last thing — roughly what time would you like to collect? 😊`
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const admin = await createAdminClient()

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const phoneNumberId = change.value?.metadata?.phone_number_id ?? ''
        for (const msg of change.value?.messages ?? []) {
          const channel = await resolveChannel(admin, phoneNumberId)
          if (!channel) continue

          if (msg.type !== 'text') {
            if (msg.from) await sendWhatsApp(channel, msg.from, 'Thanks! Please send your order as a text message, e.g. "2 cod and chips, pickup at 7pm" 🍟')
            continue
          }

          const { error: dupErr } = await admin.from('whatsapp_messages').insert({ id: msg.id, from_phone: msg.from, body: msg.text.body })
          if (dupErr) continue

          const profileName = change.value?.contacts?.[0]?.profile?.name ?? ''
          await handleMessage(admin, channel, msg, profileName)
        }
      }
    }
  } catch { /* must still 200 */ }
  return NextResponse.json({ ok: true })
}

async function handleMessage(admin: any, channel: any, msg: any, profileName: string) {
  const from = msg.from
  const text = msg.text.body
  try {
    // Van + menu + today's stops
    let van: any = null
    if (channel.van_id) {
      const { data } = await admin.from('vans').select('id, name').eq('id', channel.van_id).single()
      van = data
    } else {
      const { data } = await admin.from('vans').select('id, name').eq('is_active', true).limit(1).single()
      van = data
    }
    if (!van) return
    const vanId = van.id

    const todayDow = (new Date().getDay() + 6) % 7
    const [{ data: menu }, { data: stops }] = await Promise.all([
      admin.from('menu_items').select('id, name, price').eq('van_id', vanId).limit(200),
      admin.from('van_schedule').select('location_name, arrival_time, departure_time').eq('van_id', vanId).eq('day_of_week', todayDow).order('arrival_time'),
    ])

    // Open order from this customer still missing pickup details (last 3h)
    const { data: pendingOrder } = await admin
      .from('orders')
      .select('id, order_number, total, pickup_location, pickup_time')
      .eq('van_id', vanId)
      .eq('guest_phone', `+${from}`)
      .eq('status', 'pending')
      .or('pickup_location.is.null,pickup_time.is.null')
      .gte('created_at', new Date(Date.now() - 3 * 3600e3).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const parsed = await askClaude(buildPrompt({ menu: menu ?? [], stops: stops ?? [], pendingOrder, profileName, text }))
    const firstName = profileName ? profileName.split(' ')[0] : ''

    // ---- Customer is answering the pickup question for an open order ----
    if (parsed.action === 'pickup_details' && pendingOrder) {
      const updates: any = {}
      if (parsed.pickup_location) updates.pickup_location = parsed.pickup_location
      if (parsed.pickup_time) updates.pickup_time = parsed.pickup_time
      if (Object.keys(updates).length) {
        await admin.from('orders').update(updates).eq('id', pendingOrder.id)
      }
      const loc = updates.pickup_location ?? pendingOrder.pickup_location
      const time = updates.pickup_time ?? pendingOrder.pickup_time
      if (!loc && (stops ?? []).length) {
        await sendWhatsApp(channel, from, pickupQuestion(stops ?? [], 'location'))
        return
      }
      await admin.from('whatsapp_messages').update({ outcome: 'pickup_updated', order_id: pendingOrder.id }).eq('id', msg.id)
      await sendWhatsApp(channel, from,
        `Perfect${firstName ? `, ${firstName}` : ''}! ✅ Order #${pendingOrder.order_number} confirmed.\n📍 ${loc ?? 'the van'}${time ? ` · ${time}` : ''}\nPay cash or card at the van. We'll message you when it's ready! 🍟`)
      return
    }

    // ---- New order ----
    if (parsed.action === 'order' && parsed.items?.length) {
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
      const hasLoc = Boolean(parsed.pickup_location)
      const hasTime = Boolean(parsed.pickup_time)

      if (hasLoc && hasTime) {
        await sendWhatsApp(channel, from,
          `✅ Order received${firstName ? `, ${firstName}` : ''}!\n\n${summary}\nTotal: £${total.toFixed(2)}\n\nOrder ref: #${order_number}\n📍 ${parsed.pickup_location} · ${parsed.pickup_time}\nPay cash or card at the van. We'll message you when it's ready! 🍟`)
      } else {
        // Order saved, but ask ONE simple question for what's missing.
        const missing = !hasLoc && !hasTime ? 'both' : !hasLoc ? 'location' : 'time'
        await sendWhatsApp(channel, from,
          `✅ Got your order${firstName ? `, ${firstName}` : ''}!\n\n${summary}\nTotal: £${total.toFixed(2)} · ref #${order_number}\n\n${pickupQuestion(stops ?? [], missing)}`)
      }
      return
    }

    // ---- Anything else ----
    await admin.from('whatsapp_messages').update({ outcome: 'chat' }).eq('id', msg.id)
    await sendWhatsApp(channel, from,
      `Hi${firstName ? ` ${firstName}` : ''}! 👋 To order, just text what you'd like, e.g. "2 cod and chips". ${van.name ? `${van.name} will` : "We'll"} reply if you need anything else!`)
  } catch (e: any) {
    await admin.from('whatsapp_messages').update({ outcome: `error: ${e.message}`.slice(0, 200) }).eq('id', msg.id).catch(() => {})
    await sendWhatsApp(channel, from, 'Sorry, something went wrong taking your order automatically — the van will reply personally shortly!')
  }
}
