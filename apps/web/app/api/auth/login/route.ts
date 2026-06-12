// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()
  const cookiesToSet: any[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? 'placeholder',
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookies) { cookiesToSet.push(...cookies) },
      },
    }
  )

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  const dest = data.user?.email === 'sivakuna@icloud.com' ? '/admin/dashboard' : '/dashboard'

  // Server-side redirect with cookies attached
  const response = NextResponse.redirect(new URL(dest, request.url))
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, { ...options, sameSite: 'lax', httpOnly: false })
  })
  return response
}
