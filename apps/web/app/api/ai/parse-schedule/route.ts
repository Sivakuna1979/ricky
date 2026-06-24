// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PROMPT = `You are reading a food van schedule. Extract every location stop you can find.
Return ONLY a valid JSON array, no other text, no markdown.
Each stop object must have:
  day_of_week: number or null (0=Monday,1=Tuesday,2=Wednesday,3=Thursday,4=Friday,5=Saturday,6=Sunday — use null if day is not mentioned or unclear)
  location_name: string
  arrival_time: string (HH:MM 24-hour format, e.g. "16:30")
  departure_time: string (HH:MM 24-hour format, e.g. "20:30")
  notes: string (empty string if none)
Rules:
- Convert 12h times to 24h (4:30pm → 16:30, 8:30pm → 20:30)
- If only one time given, assume 4-hour slot
- If a day says "off" or "rest" skip it entirely
- If this looks like a route map with numbered stops and no day info, set day_of_week to null for all stops
- IMPORTANT: if you cannot confidently determine the day, set day_of_week to null — do NOT guess
Return JSON array only:`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { text, image } = body

    let content: any[]

    if (image?.data && image?.mediaType) {
      // Vision: image + instruction
      content = [
        {
          type: 'image',
          source: { type: 'base64', media_type: image.mediaType, data: image.data },
        },
        { type: 'text', text: PROMPT },
      ]
    } else if (text?.trim()) {
      // Plain text
      content = [{ type: 'text', text: `${PROMPT}\n\nSchedule text:\n${text}` }]
    } else {
      return NextResponse.json({ stops: [] })
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content }],
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '[]'
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    const stops = jsonMatch ? JSON.parse(jsonMatch[0]) : []
    return NextResponse.json({ stops })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stops: [] }, { status: 500 })
  }
}
