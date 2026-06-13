// @ts-nocheck
// Returns the logged-in user's profile, auto-creating the row if missing.
// GET → { role, redirect, profileExists, sessionExists, email }
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAIL = 'sivakuna@icloud.com'

function destFor(role: string, email: string): string {
  if (email === SUPER_ADMIN_EMAIL || role === 'super_admin') return '/admin/dashboard'
  if (role === 'business_owner' || role === 'business_admin' || role === 'owner') return '/dashboard'
  return '/account'
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ sessionExists: false, error: 'No session' }, { status: 401 })
  }

  // Super admin is determined by email only — never trust DB for this
  if (user.email === SUPER_ADMIN_EMAIL) {
    return NextResponse.json({
      sessionExists: true, profileExists: true,
      role: 'super_admin', email: user.email, redirect: '/admin/dashboard',
    })
  }

  let { data: profile } = await supabase
    .from('users').select('id, role').eq('auth_id', user.id).maybeSingle()

  let profileExists = !!profile

  // Auto-create missing profile row
  if (!profile) {
    const admin = await createAdminClient()
    const role = user.user_metadata?.role ?? 'business_owner'
    const { data: created } = await admin.from('users').insert({
      auth_id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User',
      role,
    }).select('id, role').maybeSingle()
    profile = created
    profileExists = false // it was missing, now created
  }

  const role = profile?.role ?? 'customer'
  return NextResponse.json({
    sessionExists: true,
    profileExists,
    role,
    email: user.email,
    redirect: destFor(role, user.email ?? ''),
  })
}
