// @ts-nocheck
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? 'placeholder',
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
  const path = request.nextUrl.pathname

  // Protect /admin/* — redirect non-admins to /dashboard
  if (path.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    const { data: userData } = await supabase
      .from('users').select('role').eq('auth_id', user.id).single().catch(() => ({ data: null }))
    const isAdmin = userData?.role === 'super_admin' || userData?.role === 'admin' || user.email === 'sivakuna@icloud.com'
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Protect /dashboard/* — redirect unauthenticated to /login
  if (path.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}
