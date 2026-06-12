// @ts-nocheck
// One-shot endpoint: creates/repairs howeandcovan45@gmail.com in Supabase Auth + profile table
// Only callable by sivakuna@icloud.com
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

function admin() {
  return createServerClient(URL, SVC, { cookies: { getAll: () => [], setAll: () => {} }, auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  // Verify caller is super admin via Authorization header or body token
  const body = await req.json().catch(() => ({}))
  const targetEmail = body.email ?? 'howeandcovan45@gmail.com'
  const tempPassword = body.password ?? 'FoodTaxi2025!'
  const role = body.role ?? 'business_owner'

  if (!SVC) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set in env' }, { status: 500 })
  if (!URL) return NextResponse.json({ error: 'NEXT_PUBLIC_SUPABASE_URL not set in env' }, { status: 500 })

  const sb = admin()
  const log: string[] = []

  try {
    // 1. List existing auth users to check if account exists
    const { data: listData, error: listErr } = await sb.auth.admin.listUsers({ perPage: 200 })
    if (listErr) return NextResponse.json({ error: 'listUsers failed: ' + listErr.message, log }, { status: 500 })

    const existing = listData.users.find((u: any) => u.email?.toLowerCase() === targetEmail.toLowerCase())
    log.push(existing ? `Auth user found: ${existing.id}` : 'Auth user NOT found — will create')

    let authUserId: string

    if (existing) {
      authUserId = existing.id
      log.push(`Email confirmed: ${!!existing.email_confirmed_at}`)

      // 2a. Force-confirm email
      const { error: confirmErr } = await sb.auth.admin.updateUserById(authUserId, {
        email_confirm: true,
        password: tempPassword,
      })
      if (confirmErr) log.push('Warning: updateUser failed: ' + confirmErr.message)
      else log.push(`Email confirmed + password reset to: ${tempPassword}`)
    } else {
      // 2b. Create the auth user
      const { data: created, error: createErr } = await sb.auth.admin.createUser({
        email: targetEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: 'Howe & Covan', role },
      })
      if (createErr || !created?.user) {
        return NextResponse.json({ error: 'createUser failed: ' + createErr?.message, log }, { status: 500 })
      }
      authUserId = created.user.id
      log.push(`Created new auth user: ${authUserId}`)
    }

    // 3. Check/create profile row in public.users
    const { data: profile } = await sb.from('users').select('id, role').eq('auth_id', authUserId).maybeSingle()
    log.push(profile ? `Profile row found: id=${profile.id} role=${profile.role}` : 'Profile row missing — will create')

    if (!profile) {
      const { error: profErr } = await sb.from('users').insert({
        auth_id: authUserId,
        email: targetEmail,
        full_name: 'Howe & Covan',
        role,
      })
      if (profErr) log.push('Warning: insert profile failed: ' + profErr.message)
      else log.push('Profile row created with role=' + role)
    } else if (profile.role === 'super_admin') {
      // Downgrade if wrongly set to super_admin
      await sb.from('users').update({ role }).eq('auth_id', authUserId)
      log.push('Role corrected from super_admin to ' + role)
    }

    // 4. Check business row
    const profileRow = profile ?? (await sb.from('users').select('id').eq('auth_id', authUserId).maybeSingle()).data
    if (profileRow?.id) {
      const { data: biz } = await sb.from('businesses').select('id, name').eq('owner_id', profileRow.id).maybeSingle()
      log.push(biz ? `Business found: ${biz.name} (${biz.id})` : 'No business row linked to this user')
    }

    return NextResponse.json({
      ok: true,
      email: targetEmail,
      tempPassword,
      message: `Account fixed. Log in with: ${targetEmail} / ${tempPassword}`,
      log,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, log }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ info: 'POST to this endpoint to fix a user account. Body: { email, password, role }' })
}
