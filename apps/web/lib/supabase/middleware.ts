// @ts-nocheck
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: getUser() refreshes the session and sets new cookies if needed.
  // Do NOT use getSession() here — it does not trigger token refresh.
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Protect /admin/* — ONLY sivakuna@icloud.com
  if (path.startsWith('/admin')) {
    if (!user || user.email !== 'sivakuna@icloud.com') {
      const url = request.nextUrl.clone()
      url.pathname = !user ? '/login' : '/dashboard'
      const redirectResponse = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach(cookie => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
      })
      return redirectResponse
    }
  }

  // Protect authenticated areas — redirect unauthenticated visitors to /login
  const guarded = ['/dashboard', '/business', '/account']
  if (guarded.some(p => path.startsWith(p)) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  return supabaseResponse
}
