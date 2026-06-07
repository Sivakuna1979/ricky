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

  const code = `VT-${van.id.substring(0, 8).toUpperCase()}`
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/qr/${code}`

  // Generate QR as base64 data URL
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 512,
    margin: 2,
    color: { dark: '#f97316', light: '#ffffff' },
  })

  // Check if QR already exists
  const { data: existing } = await supabase
    .from('qr_codes')
    .select('id')
    .eq('van_id', van.id)
    .single()

  if (existing) {
    const { data } = await supabase
      .from('qr_codes')
      .update({ code, url, qr_image_url: qrDataUrl })
      .eq('van_id', van.id)
      .select()
      .single()
    return NextResponse.json(data)
  }

  const { data, error } = await supabase
    .from('qr_codes')
    .insert({ van_id: van.id, code, url, qr_image_url: qrDataUrl })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
