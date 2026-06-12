// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== 'sivakuna@icloud.com') return null
  return user
}

// GET /api/admin/users — list all auth users with email + confirmation status
export async function GET() {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = await createAdminClient()
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data.users.map(u => ({
    id: u.id,
    email: u.email,
    confirmed: !!u.email_confirmed_at,
    created_at: u.created_at,
    last_sign_in: u.last_sign_in_at,
  })))
}

// POST /api/admin/users — action: "reset" | "confirm"
export async function POST(req: NextRequest) {
  if (!await requireSuperAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { action, email, user_id } = await req.json()
  const admin = await createAdminClient()

  if (action === 'reset') {
    const { error } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://food-taxi.vercel.app'}/reset-password`,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, message: `Reset email sent to ${email}` })
  }

  if (action === 'confirm') {
    const { error } = await admin.auth.admin.updateUserById(user_id, { email_confirm: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, message: `Email confirmed for ${email}` })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
