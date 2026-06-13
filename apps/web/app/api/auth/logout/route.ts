// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const cookiesToSet: Array<{ name: string; value: string; options: any }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookies) { cookiesToSet.push(...cookies) },
      },
    }
  )

  await supabase.auth.signOut()

  const response = NextResponse.redirect(new URL('/login', request.url))

  // Apply any cookie updates from signOut (clears the session cookies)
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })

  // Also explicitly clear any remaining sb- cookies
  request.cookies.getAll().forEach(({ name }) => {
    if (name.startsWith('sb-')) {
      response.cookies.set(name, '', { maxAge: 0, path: '/' })
    }
  })

  return response
}
