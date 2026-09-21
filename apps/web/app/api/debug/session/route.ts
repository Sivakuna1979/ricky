// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Phase O finding: this was reachable unauthenticated in production,
// unlike every other app/api/debug/* route, and its only real caller is
// the login page's dev/preview-only diagnostics. Rather than gate it
// behind isSuperAdmin (which would break it for an ordinary user
// debugging their own login locally), it simply refuses to return real
// session/cookie detail once NODE_ENV is production — same "safe by
// default in prod" shape as the other environment-conditioned checks
// added this phase.
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production.' }, { status: 403 })
  }
  const allCookies = request.cookies.getAll()
  const sbCookies = allCookies.filter(c => c.name.startsWith('sb-'))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key',
    { cookies: { getAll: () => allCookies, setAll: () => {} } }
  )

  const sessionResult = await supabase.auth.getSession().catch(e => ({ data: { session: null }, error: String(e) }))
  const userResult = await supabase.auth.getUser().catch(e => ({ data: { user: null }, error: String(e) }))

  return NextResponse.json({
    totalCookies: allCookies.length,
    sbCookieNames: sbCookies.map(c => c.name),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'MISSING',
    anonKeySet: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    sessionExists: !!sessionResult.data?.session,
    sessionEmail: sessionResult.data?.session?.user?.email ?? null,
    sessionError: (sessionResult as any).error ?? null,
    userExists: !!userResult.data?.user,
    userEmail: userResult.data?.user?.email ?? null,
    userError: (userResult as any).error ?? null,
  })
}
