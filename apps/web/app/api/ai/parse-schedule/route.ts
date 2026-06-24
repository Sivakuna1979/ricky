// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text?.trim()) return NextResponse.json({ stops: [] })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Parse this food van schedule description into structured stops.
Return ONLY a JSON array, no other text.
Each stop must have: day_of_week (0=Monday,1=Tuesday,2=Wednesday,3=Thursday,4=Friday,5=Saturday,6=Sunday), location_name (string), arrival_time (HH:MM 24h), departure_time (HH:MM 24h), notes (string, can be empty).
If a time is ambiguous (e.g. "4:30pm"), convert to 24h. If departure not given, add 4 hours to arrival.

Schedule text:
${text}

Return JSON array only:`
        }
      ]
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '[]'
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    const stops = jsonMatch ? JSON.parse(jsonMatch[0]) : []
    return NextResponse.json({ stops })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stops: [] }, { status: 500 })
  }
}
