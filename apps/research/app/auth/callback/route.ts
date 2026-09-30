import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/auth/server'

/** OAuth / email-confirmation callback: exchanges the code for a session. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/account'
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/account'
  const sb = supabaseServer()
  if (sb && code) {
    const { error } = await sb.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin))
  }
  return NextResponse.redirect(new URL('/sign-in?error=auth', url.origin))
}
