// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { parseWhatsAppOrderMessage } from '@/lib/ai/whatsappOrderParser'

export async function POST(req: NextRequest) {
  try {
    const { text, image, van_id } = await req.json()
    if (!van_id) return NextResponse.json({ error: 'van_id required' }, { status: 400 })
    if (!text?.trim() && !image?.data) return NextResponse.json({ error: 'Paste the WhatsApp message or upload a screenshot.' }, { status: 400 })

    // Load this van's menu so the AI can match real items and prices.
    const admin = await createAdminClient()
    const { data: menu } = await admin
      .from('menu_items')
      .select('id, name, price')
      .eq('van_id', van_id)
      .limit(200)

    const result = await parseWhatsAppOrderMessage({ menu: menu ?? [], text, image })
    if (!result.ok) {
      if (result.reason === 'refusal') {
        return NextResponse.json({ error: 'Could not process that message — try pasting the text instead.' }, { status: 422 })
      }
      return NextResponse.json({ error: 'No order items found in that message.' }, { status: 422 })
    }

    return NextResponse.json({ order: result.order })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to read the order' }, { status: 500 })
  }
}
