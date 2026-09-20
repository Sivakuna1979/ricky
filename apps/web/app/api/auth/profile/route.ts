// @ts-nocheck
// Returns the logged-in user's profile, auto-creating the row if missing.
// GET → { role, redirect, profileExists, sessionExists, email }
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/isSuperAdmin'

function destFor(isAdmin: boolean, role: string): string {
  if (isAdmin) return '/admin'
  if (role === 'business_owner' || role === 'business_admin' || role === 'owner') return '/business/dashboard'
  return '/account'
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ sessionExists: false, error: 'No session' }, { status: 401 })
  }

  if (await isSuperAdmin(supabase, user)) {
    return NextResponse.json({
      sessionExists: true, profileExists: true,
      role: 'super_admin', email: user.email, redirect: '/admin',
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
    redirect: destFor(false, role),
  })
}
