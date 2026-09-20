// @ts-nocheck
// Returns the logged-in user's profile, auto-creating the row if missing.
// GET → { role, redirect, profileExists, sessionExists, email }
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/isSuperAdmin'

const STAFF_ROLES = ['business_owner', 'business_admin', 'owner', 'van_manager', 'driver', 'staff']
function destFor(isAdmin: boolean, role: string): string {
  if (isAdmin) return '/admin'
  if (STAFF_ROLES.includes(role)) return '/business/dashboard'
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

  // First-login acceptance for an invited Phase C staff member (C16) — the
  // account and `staff` row already exist from the invite; this just marks
  // that they've actually signed in and set their password.
  if (profile?.id) {
    const admin = await createAdminClient()
    await admin.from('staff').update({ joined_at: new Date().toISOString() }).eq('user_id', profile.id).is('joined_at', null)
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
