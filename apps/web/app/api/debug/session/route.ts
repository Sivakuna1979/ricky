// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const allCookies = request.cookies.getAll()
  const sbCookies = allCookies.filter(c => c.name.startsWith('sb-'))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'missing',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'missing',
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
