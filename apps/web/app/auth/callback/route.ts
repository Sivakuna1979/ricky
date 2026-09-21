// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Handles Supabase auth redirects (email confirmation, OAuth, magic links).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/business/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data } = await supabase.auth.exchangeCodeForSession(code)

    // Phase J9 — a customer signing in via magic link for the first time
    // has an auth.users row but no `users` profile row (that row is
    // normally created by /api/auth/register during password signup).
    // Provision one lazily as role 'customer' so the rest of the app
    // (which keys off `users`, not auth.users) works immediately. Never
    // overwrites an existing row/role — a business owner who happens to
    // use a magic link keeps their existing role untouched.
    const user = data?.user
    if (user?.id) {
      try {
        const admin = await createAdminClient()
        const { data: existing } = await admin.from('users').select('id').eq('auth_id', user.id).maybeSingle()
        if (!existing) {
          await admin.from('users').insert({
            auth_id: user.id,
            email: user.email,
            full_name: user.email?.split('@')[0] ?? 'Customer',
            role: 'customer',
          })
        }
      } catch {
        // Never block sign-in on this — worst case the account hub's own
        // guard (requireCustomer) surfaces a clear error on next load.
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
