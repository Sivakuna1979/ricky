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
  "organiser_email": "",         // organiser/vendor-applications email if the sources show one, else ""
  "organiser_name": "",          // organiser or company name if shown
  "notes": "..."
}]
Rules:
- ONLY real events you found via search, with their real dates. Never invent events.
- Prefer events that welcome food vendors or have vendor/trader applications.
- UK only.`
}

// Extract a JSON array even if the output got cut off mid-array.
function extractEvents(raw: string) {
  const full = raw.match(/\[[\s\S]*\]/)
  if (full) { try { return JSON.parse(full[0]) } catch {} }
  // Truncated: salvage complete objects up to the last '}'
  const start = raw.indexOf('[')
  if (start === -1) return []
  const lastBrace = raw.lastIndexOf('}')
  if (lastBrace <= start) return []
  try { return JSON.parse(raw.slice(start, lastBrace + 1) + ']') } catch { return [] }
}

// ---------------------------------------------------------------------------
// Google-powered discovery (primary when configured): Custom Search finds the
// pages, we fetch their real content, and the model extracts events from it.
// Env: GOOGLE_CSE_ID + (GOOGLE_SEARCH_API_KEY or GOOGLE_PLACES_API_KEY)
// ---------------------------------------------------------------------------
async function googleGather(area: string, types: string) {
  const cx = process.env.GOOGLE_CSE_ID
  const key = process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_PLACES_API_KEY
  if (!cx || !key) return null

  const year = new Date().getFullYear()
  const queries = [
    `${area} ${types || 'festivals fairs'} ${year} food vendors`,
    `${area} events ${year} ${year + 1} catering pitch trader application`,
    `${area} food festival market ${year} stalls apply`,
  ]
  const links: { title: string, link: string, snippet: string }[] = []
  for (const q of queries) {
    try {
      const d = await fetch(`https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(q)}&num=6&gl=uk`).then(r => r.json())
      for (const item of d.items ?? []) {
        if (!links.find(l => l.link === item.link)) links.push({ title: item.title, link: item.link, snippet: item.snippet ?? '' })
      }
    } catch {}
  }
  if (!links.length) return null

  // Pull real page content from the top results (emails, dates, vendor info)
  const pages: string[] = []
  for (const l of links.slice(0, 6)) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 8000)
      const html = await fetch(l.link, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (FoodTaxi events)' } }).then(r => r.text())
      clearTimeout(t)
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 3500)
      pages.push(`SOURCE: ${l.link}\nTITLE: ${l.title}\n${text}`)
    } catch {
      pages.push(`SOURCE: ${l.link}\nTITLE: ${l.title}\nSNIPPET: ${l.snippet}`)
    }
  }
  const extra = links.slice(6).map(l => `SOURCE: ${l.link}\nTITLE: ${l.title}\nSNIPPET: ${l.snippet}`).join('\n\n')
  return `${pages.join('\n\n---\n\n')}\n\n---\n\n${extra}`
}

async function runDiscovery(id: string, area: string, months: number, types: string) {
  const admin = await createAdminClient()
  try {
    // Try Google first — fast, no per-search AI limits, real page content
    const gathered = await googleGather(area, types)
    if (gathered) {
      const extractPrompt = `${prompt(area, months, types)}

Instead of searching, extract the events from these Google search results and page contents (look for organiser emails in the page text):

${gathered}`
      let message
      try {
        message = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          messages: [{ role: 'user', content: extractPrompt }],
        })
      } catch {
        message = await client.messages.create({
          model: 'claude-opus-4-8',
          max_tokens: 4096,
          messages: [{ role: 'user', content: extractPrompt }],
        })
      }
      const raw = (message.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
      const events = extractEvents(raw)
      if (Array.isArray(events) && events.length) {
        return await finishDiscovery(admin, id, events, raw)
      }
      // fall through to Anthropic web search if Google found nothing usable
    }

    const tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }]
    const messages: any[] = [{ role: 'user', content: `${prompt(area, months, types)}\nRun your searches ONE AT A TIME, never in parallel.` }]

    const call = async (model: string, useBeta: boolean, toolset: any[]) => {
      // Web search turns can pause mid-run — continue until the model finishes.
      let msgs = [...messages]
      let message: any
      for (let i = 0; i < 4; i++) {
        const params: any = { model, max_tokens: 8192, tools: toolset, messages: msgs }
        if (useBeta) {
          params.output_config = { effort: 'low' }
          params.betas = ['server-side-fallback-2026-06-01']
          params.fallbacks = [{ model: 'claude-opus-4-8' }]
          message = await client.beta.messages.create(params)
        } else {
          message = await client.messages.create(params)
        }
        if (message.stop_reason !== 'pause_turn') break
        msgs = [...msgs, { role: 'assistant', content: message.content }]
      }
      return message
    }

    let message
    try {
      message = await call('claude-fable-5', true, tools)
    } catch {
      try {
        message = await call('claude-opus-4-8', false, tools)
      } catch {
        message = await call('claude-opus-4-8', false, [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }])
      }
    }

    const raw = (message.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
    const events = extractEvents(raw)
    await finishDiscovery(admin, id, events, raw)
  } catch (err: any) {
    await admin.from('ai_event_discoveries').update({ status: 'error', error: (err.message ?? 'Search failed').slice(0, 400) }).eq('id', id)
  }
}

async function finishDiscovery(admin: any, id: string, events: any, raw: string) {
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
      organiser_email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.organiser_email ?? '') ? e.organiser_email : '',
      organiser_name: String(e.organiser_name ?? '').slice(0, 120),
      notes: String(e.notes ?? '').slice(0, 500),
    }))
    .filter((e: any) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && new Date(e.date) >= new Date(new Date().toDateString()))

  await admin.from('ai_event_discoveries').update({
    status: 'done',
    events: clean,
    // When empty, keep a snippet of what the AI actually said so we can diagnose.
    error: clean.length ? null : `No events extracted. AI said: ${raw.slice(0, 300) || '(no text output)'}`,
  }).eq('id', id)
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
