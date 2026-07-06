// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PROMPT = `You are a brand designer. Look at this business design (menu, van livery, flyer or logo).
Extract the brand identity so we can theme their web page to match.
Return ONLY a valid JSON object, no other text, no markdown:
{
  "primary": "#RRGGBB",    // the single strongest brand colour (logo / headings / dominant theme)
  "secondary": "#RRGGBB",  // supporting colour that pairs with primary (for gradients)
  "accent": "#RRGGBB",     // small-highlight colour (prices, badges) — must be readable on dark backgrounds
  "bg": "dark" or "light", // which page background suits this brand best
  "logo_text": "..."       // the business name exactly as styled on the design, or ""
}
Rules:
- Colours must be real hex codes sampled from the design's dominant branding, not generic defaults.
- Avoid near-white or near-black for primary/accent; pick vivid usable colours.
- If the design is multicoloured, choose the 2-3 colours that best represent the brand.`

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json()
    if (!image?.data || !image?.mediaType) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
          { type: 'text', text: PROMPT },
        ],
      }],
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '{}'
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const brand = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    if (!brand?.primary) return NextResponse.json({ error: 'Could not read a brand from that image — try a clearer photo of your design.' }, { status: 422 })

    // Basic sanity: keep only expected fields, validate hex colours.
    const hex = (c: any) => (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : null)
    const clean = {
      primary: hex(brand.primary) ?? '#f97316',
      secondary: hex(brand.secondary) ?? hex(brand.primary) ?? '#ea580c',
      accent: hex(brand.accent) ?? hex(brand.primary) ?? '#fdba74',
      bg: brand.bg === 'light' ? 'light' : 'dark',
      logo_text: typeof brand.logo_text === 'string' ? brand.logo_text.slice(0, 60) : '',
    }
    return NextResponse.json({ brand: clean })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Brand scan failed' }, { status: 500 })
  }
}
