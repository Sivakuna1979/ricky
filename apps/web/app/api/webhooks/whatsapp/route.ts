// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { waitUntil } from '@vercel/functions'
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

// AI replies can take a while — never let the platform kill us mid-order.
export const maxDuration = 300

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
      .select('phone_number_id, access_token, van_id, is_shared')
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

// weekSchedule: [{ dayLabel: 'Today (Tuesday 7 Jul)', stops: [...] }, ...]
// ---------------------------------------------------------------------------
// Shared FoodTaxi number: work out WHICH van this customer is ordering from.
// Name match in the message wins; otherwise their remembered van; otherwise
// ask once with a numbered list (number replies resolve against it).
// ---------------------------------------------------------------------------
const STOPWORDS = new Set(['the','and','co','van','food','fish','chips','chip','a','of','ltd'])
function nameMatches(text: string, name: string) {
  const t = text.toLowerCase()
  const n = (name ?? '').toLowerCase().trim()
  if (!n) return false
  if (t.includes(n)) return true
  const tokens = n.split(/[^a-z0-9']+/).filter(w => w.length >= 4 && !STOPWORDS.has(w))
  if (!tokens.length) return false
  const hits = tokens.filter(w => t.includes(w)).length
  return hits >= Math.min(2, tokens.length)
}

async function resolveSharedVan(admin: any, channel: any, from: string, text: string, firstName: string) {
  const { data: vans } = await admin
    .from('vans')
    .select('id, name, business_id, businesses(name)')
    .eq('is_active', true)
    .limit(100)
  const list = vans ?? []
  if (!list.length) return null
  if (list.length === 1) return list[0]

  const { data: pref } = await admin
    .from('whatsapp_customer_prefs').select('van_id, options').eq('phone', from).maybeSingle()

  const remember = async (vanId: string) => {
    await admin.from('whatsapp_customer_prefs').upsert({ phone: from, van_id: vanId, options: null, updated_at: new Date().toISOString() })
  }

  // Numbered reply to a list we offered ("1", "2"...)
  const numMatch = text.trim().match(/^([1-9][0-9]?)\b/)
  if (numMatch && Array.isArray(pref?.options)) {
    const picked = list.find((v: any) => v.id === pref.options[Number(numMatch[1]) - 1])
    if (picked) { await remember(picked.id); return picked }
  }

  // Business/van named in the message (also lets customers switch van any time)
  const named = list.filter((v: any) => nameMatches(text, v.name) || nameMatches(text, v.businesses?.name))
  if (named.length === 1) { await remember(named[0].id); return named[0] }

  // Their usual van
  if (pref?.van_id) {
    const usual = list.find((v: any) => v.id === pref.van_id)
    if (usual) return usual
  }

  // Ask once, with a numbered list
  const choices = (named.length > 1 ? named : list).slice(0, 8)
  await admin.from('whatsapp_customer_prefs').upsert({
    phone: from, van_id: pref?.van_id ?? null, options: choices.map((v: any) => v.id), updated_at: new Date().toISOString(),
  })
  await sendWhatsApp(channel, from,
    `Hi${firstName ? ` ${firstName}` : ''}! 👋 Which van would you like to order from? Reply with the number:\n${choices.map((v: any, i: number) => `${i + 1}. ${v.name}`).join('\n')}`)
  return null
}

function buildPrompt({ menu, weekSchedule, pendingOrder, profileName, text }: any) {
  const scheduleList = weekSchedule.length
    ? weekSchedule.map((d: any) =>
        `${d.dayLabel}:\n${d.stops.length ? d.stops.map((s: any) => `  - ${s.location_name} (${s.arrival_time}–${s.departure_time})`).join('\n') : '  (van not out)'}`
      ).join('\n')
    : '(no schedule available)'
  const missingName = pendingOrder && (!pendingOrder.guest_name || pendingOrder.guest_name === 'WhatsApp customer')
  const pendingBit = pendingOrder
    ? `\nIMPORTANT CONTEXT: this customer has an open order #${pendingOrder.order_number} (£${Number(pendingOrder.total).toFixed(2)}) that is still missing ${[!pendingOrder.pickup_location && 'a pickup stop', !pendingOrder.pickup_time && 'a pickup time', missingName && 'their name'].filter(Boolean).join(' and ')}. If this message provides any of those details (a day, a stop name, a time, and/or their name), use action "pickup_details".`
    : ''
  return `You are the WhatsApp assistant for a food van. The van's stops for the next 7 days:
${scheduleList}

Menu (id | name | price):
${menu.map((m: any) => `${m.id} | ${m.name} | £${Number(m.price).toFixed(2)}`).join('\n')}
${pendingBit}

Return ONLY valid JSON:
{
  "action": "order" | "pickup_details" | "chat",
  "items": [{"menu_item_id":"...or null","name":"...","quantity":1,"price":0.0}],
  "pickup_day": "",        // the day label EXACTLY as written above (e.g. "Wednesday 9 Jul") if the customer names or implies a day; "" otherwise
  "pickup_location": "",   // exact stop name from the schedule above when possible
  "pickup_time": "",       // e.g. "18:30" or "around 7pm"; if they pick a stop, default to that stop's arrival time
  "customer_name": "",     // if the customer states their name (e.g. "it's John", "name is Sarah")
  "notes": ""
}
Rules:
- action "order": the message contains food items to order. Match items to the menu (use its id/name/price); unknown items get menu_item_id null and price 0; "two cod" means quantity 2.
- action "pickup_details": no new food items, but the message gives a day, a stop, a time and/or their name for the open order. Examples: "Tesco's at 7", "the 6:30 one", "I want Wednesday", "Wednesday 1st stop", "tomorrow", "it's Sarah".
- action "chat": anything else (greeting, question).
- "Wednesday 1st stop" means the FIRST stop listed under Wednesday — set pickup_day, pickup_location and pickup_time from that stop.
- "tomorrow" or a weekday name selects that day from the schedule. NEVER pick a stop from a different day than the customer asked for.
- If they name a day with no stop yet, set pickup_day only and leave pickup_location "".
- Keep special requests in notes.

WhatsApp message from ${profileName || 'customer'}:
${text}`
}

async function askClaude(prompt: string) {
  // Order-reading must be FAST (webhook runs under tight platform limits).
  // Haiku is the same model that powers the proven menu/schedule scanners —
  // 1-3s replies. Opus is the quality fallback if Haiku errors.
  let message
  try {
    message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1536,
      messages: [{ role: 'user', content: prompt }],
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

// One short question covering everything missing — never an interrogation.
function followUpQuestion(stops: any[], needs: { location: boolean, time: boolean, name: boolean }, dayLabel = '') {
  const namePart = needs.name ? ' and your name' : ''
  const dayWord = dayLabel && !String(dayLabel).startsWith('Today') ? `On ${dayLabel} we're` : `Today we're`
  if (needs.location && stops.length) {
    const list = stops.map((s: any) => `📍 ${s.location_name} (${s.arrival_time}–${s.departure_time})`).join('\n')
    return `One last thing — where would you like to collect? ${dayWord} at:\n${list}\nJust reply with the stop${needs.time ? ', a rough time' : ''}${namePart} — or tell us another day 😊`
  }
  if (needs.time) return `One last thing — roughly what time would you like to collect${namePart}? 😊`
  return `One last thing — what name should we put on the order? 😊`
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

          const { error: dupErr } = await admin.from('whatsapp_messages').insert({ id: msg.id, from_phone: msg.from, body: msg.text.body, outcome: 'processing' })
          if (dupErr) continue

          const profileName = change.value?.contacts?.[0]?.profile?.name ?? ''
          // Process BEFORE responding — this platform freezes background work
          // once the response is sent, so the reply must be composed inline.
          // Haiku keeps the whole round-trip to a few seconds.
          await handleMessage(admin, channel, msg, profileName).catch(async (e: any) => {
            await admin.from('whatsapp_messages').update({ outcome: `fatal: ${e.message}`.slice(0, 200) }).eq('id', msg.id).catch(() => {})
          })
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
    const earlyName = profileName ? profileName.split(' ')[0] : ''
    let van: any = null
    if (channel.is_shared) {
      van = await resolveSharedVan(admin, channel, from, text, earlyName)
      if (!van) {
        await admin.from('whatsapp_messages').update({ outcome: 'asked_business' }).eq('id', msg.id)
        return // we asked which van — their reply resolves it
      }
    } else if (channel.van_id) {
      const { data } = await admin.from('vans').select('id, name').eq('id', channel.van_id).single()
      van = data
    } else {
      const { data } = await admin.from('vans').select('id, name').eq('is_active', true).limit(1).single()
      van = data
    }
    if (!van) {
      await admin.from('whatsapp_messages').update({ outcome: 'no_van' }).eq('id', msg.id)
      return
    }
    await admin.from('whatsapp_messages').update({ outcome: `van_ok` }).eq('id', msg.id)
    const vanId = van.id

    const [{ data: menu }, { data: allStops }] = await Promise.all([
      admin.from('menu_items').select('id, name, price').eq('van_id', vanId).limit(200),
      admin.from('van_schedule').select('location_name, arrival_time, departure_time, day_of_week').eq('van_id', vanId).order('day_of_week').order('arrival_time'),
    ])

    // Next 7 days with their stops — so "Wednesday", "tomorrow" etc. work.
    const weekSchedule = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const dow = (d.getDay() + 6) % 7
      const dateBit = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
      const dayLabel = i === 0 ? `Today (${dateBit})` : i === 1 ? `Tomorrow (${dateBit})` : dateBit
      return { dayLabel, stops: (allStops ?? []).filter((s: any) => s.day_of_week === dow) }
    })
    const todayStops = weekSchedule[0].stops
    const stopsForDay = (dayLabel: string) =>
      (weekSchedule.find(d => d.dayLabel === dayLabel) ?? weekSchedule.find(d => dayLabel && d.dayLabel.toLowerCase().includes(String(dayLabel).toLowerCase().split(' ')[0])))?.stops ?? todayStops
    // Store the day inside pickup_time so the dashboard shows it: "Wednesday 9 Jul · 16:30"
    const dayForRecord = (dayLabel: string) => !dayLabel || dayLabel.startsWith('Today') ? '' : dayLabel.replace(/^Tomorrow \((.+)\)$/, '$1')

    // Open order from this customer still missing details (last 3h)
    const { data: pendingOrder } = await admin
      .from('orders')
      .select('id, order_number, total, pickup_location, pickup_time, guest_name')
      .eq('van_id', vanId)
      .eq('guest_phone', `+${from}`)
      .eq('status', 'pending')
      .or('pickup_location.is.null,pickup_time.is.null,guest_name.eq.WhatsApp customer')
      .gte('created_at', new Date(Date.now() - 3 * 3600e3).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    await admin.from('whatsapp_messages').update({ outcome: 'ai_start' }).eq('id', msg.id)
    // Hard cap the AI think-time so a stall can never leave the customer hanging.
    const parsed = await Promise.race([
      askClaude(buildPrompt({ menu: menu ?? [], weekSchedule, pendingOrder, profileName, text })),
      new Promise((_, rej) => setTimeout(() => rej(new Error('AI timeout after 20s')), 20000)),
    ])
    await admin.from('whatsapp_messages').update({ outcome: `ai:${parsed.action ?? 'unknown'}` }).eq('id', msg.id)
    const knownName = parsed.customer_name?.trim() || (profileName && profileName !== 'WhatsApp customer' ? profileName : '')
    const firstName = knownName ? knownName.split(' ')[0] : ''
    const dayBit = dayForRecord(parsed.pickup_day ?? '')
    const composedTime = parsed.pickup_time ? `${dayBit ? `${dayBit} · ` : ''}${parsed.pickup_time}` : (dayBit || '')

    // ---- Customer is answering the follow-up question for an open order ----
    if (parsed.action === 'pickup_details' && pendingOrder) {
      const updates: any = {}
      if (parsed.pickup_location) updates.pickup_location = parsed.pickup_location
      if (composedTime) updates.pickup_time = composedTime
      if (parsed.customer_name?.trim()) updates.guest_name = parsed.customer_name.trim()
      if (Object.keys(updates).length) {
        await admin.from('orders').update(updates).eq('id', pendingOrder.id)
      }
      const dayStops = stopsForDay(parsed.pickup_day ?? '')
      const loc = updates.pickup_location ?? pendingOrder.pickup_location
      const time = updates.pickup_time ?? pendingOrder.pickup_time
      const name = updates.guest_name ?? (pendingOrder.guest_name !== 'WhatsApp customer' ? pendingOrder.guest_name : '')
      const stillNeeds = { location: !loc && dayStops.length > 0, time: !time, name: !name }
      if (stillNeeds.location || stillNeeds.name) {
        await sendWhatsApp(channel, from, followUpQuestion(dayStops, stillNeeds, parsed.pickup_day))
        return
      }
      await admin.from('whatsapp_messages').update({ outcome: 'pickup_updated', order_id: pendingOrder.id }).eq('id', msg.id)
      await sendWhatsApp(channel, from,
        `Perfect${name ? `, ${name.split(' ')[0]}` : ''}! ✅ Order #${pendingOrder.order_number} confirmed — ${van.name}.\n📍 ${loc ?? 'the van'}${time ? ` · ${time}` : ''}\nPay cash or card at the van. We'll message you when it's ready! 🍟`)
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
        guest_name: knownName || 'WhatsApp customer',
        guest_phone: `+${from}`,
        notes: `[WhatsApp auto-order]${parsed.notes ? ' ' + parsed.notes : ''}`,
        pickup_location: parsed.pickup_location || null,
        pickup_time: composedTime || null,
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
      const dayStops = stopsForDay(parsed.pickup_day ?? '')
      const needs = {
        location: !parsed.pickup_location && dayStops.length > 0,
        time: !parsed.pickup_time,
        name: !knownName,
      }

      if (!needs.location && !needs.time && !needs.name) {
        await sendWhatsApp(channel, from,
          `✅ Order received${firstName ? `, ${firstName}` : ''} — ${van.name}!\n\n${summary}\nTotal: £${total.toFixed(2)}\n\nOrder ref: #${order_number}\n📍 ${parsed.pickup_location} · ${composedTime}\nPay cash or card at the van. We'll message you when it's ready! 🍟`)
      } else {
        // Order saved, but ask ONE simple question covering whatever is missing.
        await sendWhatsApp(channel, from,
          `✅ Got your order${firstName ? `, ${firstName}` : ''} — ${van.name}!\n\n${summary}\nTotal: £${total.toFixed(2)} · ref #${order_number}\n\n${followUpQuestion(dayStops, needs, parsed.pickup_day)}`)
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
