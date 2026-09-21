// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// QR code redirect — increments scan count then redirects to van page
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const supabase = await createClient()

  const { data: qr } = await supabase
    .from('qr_codes')
    .select('url, van_id, context, context_id, vans(slug)')
    .eq('code', params.code)
    .single()

  if (!qr) {
    return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL ?? 'https://food-taxi.vercel.app'))
  }

  // Increment scan count asynchronously (don't await to keep redirect fast)
  supabase.rpc('increment_qr_scan', { code_value: params.code }).then(() => {})

  const vanSlug = (qr.vans as any)?.slug
  // J28 — the QR's stored context decides the destination; it is never
  // trusted beyond that (the destination page re-validates everything
  // itself — e.g. the van page re-checks a stop against the live
  // schedule before ever using it in an order).
  let redirectUrl = qr.url
  if (vanSlug) {
    if (qr.context === 'board') redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/van/${vanSlug}/board`
    else if (qr.context === 'stop' && qr.context_id) redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/van/${vanSlug}?stop=${qr.context_id}`
    else redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/van/${vanSlug}`
  }

  return NextResponse.redirect(new URL(redirectUrl))
}
