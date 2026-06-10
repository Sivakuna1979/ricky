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
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — must be called before any redirects
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // If not logged in and trying to access protected path → login
  const protectedPaths = ['/dashboard', '/admin', '/driver', '/account']
  const isProtected = protectedPaths.some(p => path.startsWith(p))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', path)
    return NextResponse.redirect(url)
  }

  // Admin route protection — check email bypass FIRST, then role
  // This prevents a DB lookup failure from locking out the owner
  if (path.startsWith('/admin') && user) {
    const ownerEmail = process.env.SUPER_ADMIN_EMAIL ?? 'sivakuna@icloud.com'

    // Owner email always gets through — no DB lookup needed
    if (user.email === ownerEmail) {
      return supabaseResponse
    }

    // For other users check DB role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single()

    const role = userData?.role
    if (role !== 'super_admin' && role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}
