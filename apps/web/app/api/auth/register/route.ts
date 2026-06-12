// @ts-nocheck
// Called after signUp to auto-confirm email and create user profile
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { user_id, email, full_name, role } = await req.json()
    if (!user_id || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const admin = await createAdminClient()

    // 1. Auto-confirm the email so users can log in immediately
    await admin.auth.admin.updateUserById(user_id, { email_confirm: true })

    // 2. Upsert profile row
    const { error } = await admin.from('users').upsert({
      auth_id: user_id,
      email,
      full_name: full_name ?? email.split('@')[0],
      role: role ?? 'business_owner',
    }, { onConflict: 'auth_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
