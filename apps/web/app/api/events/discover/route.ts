// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAIL = 'sivakuna@icloud.com'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const maxDuration = 60

function prompt(area: string, months: number, types: string) {
  return `Search the web for REAL upcoming events in or near ${area}, UK, over the next ${months} months, where street food vans / mobile caterers could trade or be booked: ${types || 'festivals, food festivals, markets, fairs, carnivals, sports events, county shows, Christmas markets'}.

Find as many genuine events as you can (aim for 8-15). For each, extract what the sources actually say.

Return ONLY a valid JSON array, no other text, no markdown:
[{
  "name": "...",                 // event name
  "date": "YYYY-MM-DD",          // start date; if only a month is known use the 1st and note it
  "event_time": "",              // e.g. "10:00-17:00" if known
  "location": "...",             // venue + town
  "postcode": "",                // venue postcode if found, else ""
  "region": "...",               // one of: London, South East, South West, East of England, East Midlands, West Midlands, Yorkshire, North West, North East, Wales, Scotland, Northern Ireland
  "event_type": "festival|market|sports|corporate|other",
  "footfall": 0,                 // estimated attendance if mentioned, else 0
  "source_url": "...",           // where you found it
  "notes": "..."                 // organiser, vendor application info, anything useful for a food van
}]
Rules:
- ONLY real events you found via search, with their real dates. Never invent events.
- Prefer events that welcome food vendors or have vendor/trader applications.
- UK only.`
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
  }

  try {
    const { area, months = 12, types = '' } = await req.json()
    if (!area?.trim()) return NextResponse.json({ error: 'Tell me the area to search (town, county or region).' }, { status: 400 })

    const tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }]
    const messages = [{ role: 'user', content: prompt(area.trim(), months, types) }]

    let message
    try {
      // Claude Fable 5 with live web search; server-side fallback to Opus 4.8
      message = await client.beta.messages.create({
        model: 'claude-fable-5',
        max_tokens: 8192,
        tools,
        messages,
        betas: ['server-side-fallback-2026-06-01'],
        fallbacks: [{ model: 'claude-opus-4-8' }],
      })
    } catch {
      message = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 8192,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }],
        messages,
      })
    }

    const raw = (message.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    const events = jsonMatch ? JSON.parse(jsonMatch[0]) : []
    if (!Array.isArray(events) || !events.length) {
      return NextResponse.json({ error: 'No events found for that area — try a bigger area or different wording.', events: [] }, { status: 200 })
    }

    // Sanitise
    const clean = events
      .filter((e: any) => e?.name && e?.date)
      .map((e: any) => ({
        name: String(e.name).slice(0, 140),
        date: String(e.date).slice(0, 10),
        event_time: e.event_time ?? '',
        location: String(e.location ?? '').slice(0, 180),
        postcode: String(e.postcode ?? '').slice(0, 10),
        region: e.region ?? '',
        event_type: ['festival','market','sports','corporate','wedding','birthday','private','other'].includes(e.event_type) ? e.event_type : 'festival',
        footfall: Number(e.footfall) || null,
        source_url: String(e.source_url ?? '').slice(0, 300),
        notes: String(e.notes ?? '').slice(0, 500),
      }))
      .filter((e: any) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && new Date(e.date) >= new Date(new Date().toDateString()))

    return NextResponse.json({ events: clean })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Event discovery failed' }, { status: 500 })
  }
}
