// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Business owner requests WhatsApp ordering — FoodTaxi staff do the setup.
export async function POST(req: NextRequest) {
  try {
    const { phone, note } = await req.json()
    if (!phone?.trim()) return NextResponse.json({ error: 'Please give us a contact number.' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

    const { data: userRow } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    const { data: biz } = userRow
      ? await supabase.from('businesses').select('id, name').eq('owner_id', userRow.id).maybeSingle()
      : { data: null }
    if (!biz) return NextResponse.json({ error: 'No business found for this account.' }, { status: 403 })

    const admin = await createAdminClient()
    const { error } = await admin.from('whatsapp_requests').insert({
      business_id: biz.id,
      contact_phone: phone.trim(),
      note: note ?? '',
      status: 'pending',
    })
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to send request' }, { status: 500 })
  }
}
