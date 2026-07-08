// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { waitUntil } from '@vercel/functions'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAIL = 'sivakuna@icloud.com'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const maxDuration = 300

function prompt(area: string, months: number, types: string) {
  return `Search the web for REAL upcoming events in or near ${area}, UK, over the next ${months} months, where street food vans / mobile caterers could trade or be booked: ${types || 'festivals, food festivals, markets, fairs, carnivals, sports events, county shows, Christmas markets'}.

Work FAST: do at most 3 searches (e.g. "${area} festivals ${new Date().getFullYear()} food vendors"), then answer from what you found. Aim for 5-10 genuine events. For each, extract what the sources actually say.

Return ONLY a valid JSON array, no other text, no markdown:
[{
  "name": "...",
  "date": "YYYY-MM-DD",
  "event_time": "",
  "location": "...",
  "postcode": "",
  "region": "...",               // one of: London, South East, South West, East of England, East Midlands, West Midlands, Yorkshire, North West, North East, Wales, Scotland, Northern Ireland
  "event_type": "festival|market|sports|corporate|other",
  "footfall": 0,
  "source_url": "...",
  "notes": "..."
}]
Rules:
- ONLY real events you found via search, with their real dates. Never invent events.
- Prefer events that welcome food vendors or have vendor/trader applications.
- UK only.`
}

async function runDiscovery(id: string, area: string, months: number, types: string) {
  const admin = await createAdminClient()
  try {
    const tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }]
    const messages = [{ role: 'user', content: prompt(area, months, types) }]

    let message
    try {
      message = await client.beta.messages.create({
        model: 'claude-fable-5',
        max_tokens: 4096,
        output_config: { effort: 'low' },
        tools,
        messages,
        betas: ['server-side-fallback-2026-06-01'],
        fallbacks: [{ model: 'claude-opus-4-8' }],
      })
    } catch {
      try {
        message = await client.messages.create({ model: 'claude-opus-4-8', max_tokens: 4096, tools, messages })
      } catch {
        message = await client.messages.create({
          model: 'claude-opus-4-8',
          max_tokens: 4096,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
          messages,
        })
      }
    }

    const raw = (message.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    const events = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    const clean = (Array.isArray(events) ? events : [])
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

    await admin.from('ai_event_discoveries').update({
      status: 'done',
      events: clean,
      error: clean.length ? null : 'No events found for that area — try a bigger area or different wording.',
    }).eq('id', id)
  } catch (err: any) {
    await admin.from('ai_event_discoveries').update({ status: 'error', error: (err.message ?? 'Search failed').slice(0, 400) }).eq('id', id)
  }
}

// POST { area, months, types } -> { id }   (search runs in the background)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
  }

  const { area, months = 12, types = '' } = await req.json().catch(() => ({}))
  if (!area?.trim()) return NextResponse.json({ error: 'Tell me the area to search (town, county or region).' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: row, error } = await admin
    .from('ai_event_discoveries')
    .insert({ area: area.trim(), status: 'running' })
    .select('id')
    .single()
  if (error) {
    return NextResponse.json({ error: `Run the ai_event_discoveries SQL first — ${error.message}` }, { status: 500 })
  }

  waitUntil(runDiscovery(row.id, area.trim(), parseInt(months) || 12, types))
  return NextResponse.json({ id: row.id })
}

// GET ?id=... -> { status, events, error }
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data } = await admin.from('ai_event_discoveries').select('status, events, error').eq('id', id).single()
  return NextResponse.json(data ?? { status: 'error', error: 'Not found' })
}
