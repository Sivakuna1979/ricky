// @ts-nocheck
// H11 — "document → extract → review → confirm → expense". Reuses the
// exact pattern app/api/menu/scan already uses (Claude vision on a
// base64 image, structured JSON back) rather than inventing a second
// extraction mechanism. The image itself is never persisted — only the
// extracted structured data is stored (finance_documents.extracted_data),
// as PENDING review, not authoritative (H66) until a person reviews it
// and POSTs it on to /api/finance/expenses or /api/finance/supplier-invoices.
// No file storage/signed-URL infrastructure exists anywhere in this app
// yet (see the Phase H migration's audit comment) — none is introduced
// here either; file_url stays an optional external link, same convention
// as vehicle_documents/hygiene_documents.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EXTRACTION_PROMPT = `You are a receipt/invoice scanning assistant for a small UK food business's bookkeeping. Extract the following from this image and return ONLY a valid JSON object, nothing else:
{
  "kind": "receipt" or "invoice",
  "supplier_name": "string or null",
  "invoice_number": "string or null",
  "date": "YYYY-MM-DD or null",
  "net_amount": 0.00 or null,
  "vat_amount": 0.00 or null,
  "gross_amount": 0.00,
  "suggested_category": "one of: food_stock, drinks, packaging, fuel, vehicle, repairs, equipment, insurance, rent_storage, phone_internet, marketing, staff, cleaning, professional_fees, other",
  "confidence": "high" or "medium" or "low"
}
Rules: gross_amount is the only field that must always be a number (use the clearest total on the document). If net/VAT are not clearly shown, set them to null rather than guessing — do not invent numbers that aren't on the document. If you cannot read the document at all, set confidence to "low" and gross_amount to 0.`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'create_expense')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { imageBase64, mediaType, source_kind } = await req.json()
  if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: doc } = await admin.from('finance_documents').insert({
    business_id: ctx.businessId, uploaded_by: ctx.userId, source_kind: source_kind ?? 'receipt', extraction_status: 'PENDING',
  }).select().single()

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8', max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType ?? 'image/jpeg', data: imageBase64 } },
          { type: 'text', text: EXTRACTION_PROMPT },
        ],
      }],
    })
    const text = response.content.find((b: any) => b.type === 'text')?.text ?? '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : { confidence: 'low', gross_amount: 0 }

    await admin.from('finance_documents').update({ extracted_data: extracted, extraction_status: 'EXTRACTED' }).eq('id', doc.id)
    return NextResponse.json({ document_id: doc.id, extracted, note: 'Unconfirmed — review these fields before they become an expense.' })
  } catch (e: any) {
    await admin.from('finance_documents').update({ extraction_status: 'FAILED' }).eq('id', doc.id)
    return NextResponse.json({ document_id: doc.id, error: 'Could not read this document — enter the details manually.' }, { status: 200 })
  }
}
