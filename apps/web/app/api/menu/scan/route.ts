// @ts-nocheck
/**
 * POST /api/menu/scan
 * Accepts a base64-encoded menu card image, sends to Claude vision,
 * returns extracted menu items ready to insert.
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType ?? 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `You are a menu scanning assistant. Extract ALL menu items from this menu card image.

Return ONLY a valid JSON object in this exact format, nothing else:
{
  "business_name": "string or null",
  "phone": "string or null",
  "email": "string or null",
  "items": [
    {
      "name": "item name",
      "price": 0.00,
      "category": "one of: Fish, Chips, Burgers, Chicken, Vegetarian, Sides, Extras, Drinks, Desserts, Specials, Mains",
      "description": "brief description or empty string"
    }
  ]
}

Rules:
- Extract every single item and price visible
- Price must be a number (e.g. 9.00 not "£9.00")
- If an item has no price, use 0
- Pick the most fitting category from the list
- If you see "Fish" section, use category "Fish"
- If you see "Chips" section, use category "Chips"
- If you see "Extras" section, use category "Extras"
- If you see "Drinks" or "Can Drink", use category "Drinks"
- If you see "Vegetarian" section, use category "Vegetarian"
- Do not add any text before or after the JSON`,
          },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Could not parse menu', raw: text }, { status: 422 })

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json(parsed)
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Scan failed' }, { status: 500 })
  }
}
