// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'

export async function POST(req: NextRequest, { params }: { params: { vanId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: van } = await supabase
    .from('vans')
    .select('id, slug')
    .eq('id', params.vanId)
    .single()

  if (!van) return NextResponse.json({ error: 'Van not found' }, { status: 404 })

  // J28 — optional contextual QR: 'van' (default, unchanged), 'stop'
  // (validated below against this van's own schedule) or 'board'.
  const body = await req.json().catch(() => ({}))
  const context = ['van', 'stop', 'board'].includes(body?.context) ? body.context : 'van'
  let contextId: string | null = null
  if (context === 'stop') {
    if (!body?.context_id) return NextResponse.json({ error: 'context_id required for a stop QR code' }, { status: 400 })
    const { data: stop } = await supabase.from('van_schedule').select('id').eq('id', body.context_id).eq('van_id', van.id).maybeSingle()
    if (!stop) return NextResponse.json({ error: 'Stop not found on this van' }, { status: 404 })
    contextId = stop.id
  }

  const suffix = context === 'stop' ? `-S${contextId!.substring(0, 6).toUpperCase()}` : context === 'board' ? '-BOARD' : ''
  const code = `VT-${van.id.substring(0, 8).toUpperCase()}${suffix}`
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/qr/${code}`

  // Generate QR as base64 data URL
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 512,
    margin: 2,
    color: { dark: '#f97316', light: '#ffffff' },
  })

  // Check if this exact (van, context, context_id) QR already exists
  let existingQuery = supabase.from('qr_codes').select('id').eq('van_id', van.id).eq('context', context)
  existingQuery = contextId ? existingQuery.eq('context_id', contextId) : existingQuery.is('context_id', null)
  const { data: existing } = await existingQuery.maybeSingle()

  if (existing) {
    const { data } = await supabase
      .from('qr_codes')
      .update({ code, url, qr_image_url: qrDataUrl })
      .eq('id', existing.id)
      .select()
      .single()
    return NextResponse.json(data)
  }

  const { data, error } = await supabase
    .from('qr_codes')
    .insert({ van_id: van.id, code, url, qr_image_url: qrDataUrl, context, context_id: contextId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
