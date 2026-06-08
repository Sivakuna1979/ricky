// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// QR code redirect — increments scan count then redirects to van page
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const supabase = await createClient()

  const { data: qr } = await supabase
    .from('qr_codes')
    .select('url, van_id, vans(slug)')
    .eq('code', params.code)
    .single()

  if (!qr) {
    return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL!))
  }

  // Increment scan count asynchronously (don't await to keep redirect fast)
  supabase.rpc('increment_qr_scan', { code_value: params.code }).then(() => {})

  const vanSlug = (qr.vans as any)?.slug
  const redirectUrl = vanSlug
    ? `${process.env.NEXT_PUBLIC_APP_URL}/van/${vanSlug}`
    : qr.url

  return NextResponse.redirect(new URL(redirectUrl))
}
