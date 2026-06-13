// @ts-nocheck
// Debug endpoint: shows DB state for a given email — only callable when logged in as super admin
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

function admin() {
  return createServerClient(URL, SVC, { cookies: { getAll: () => [], setAll: () => {} }, auth: { persistSession: false } })
}

export async function GET(req: NextRequest) {
  if (!SVC) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })

  const email = req.nextUrl.searchParams.get('email') ?? 'howeandcovan45@gmail.com'
  const sb = admin()

  // 1. Auth user
  const { data: listData } = await sb.auth.admin.listUsers({ perPage: 200 })
  const authUser = listData?.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())

  // 2. Users table row
  let usersRow = null
  if (authUser) {
    const { data } = await sb.from('users').select('*').eq('auth_id', authUser.id).maybeSingle()
    usersRow = data
  }
  // Also try by email
  const { data: usersRowByEmail } = await sb.from('users').select('*').eq('email', email).maybeSingle()

  // 3. Businesses row
  let bizByOwnerId = null
  const profileId = usersRow?.id ?? usersRowByEmail?.id
  if (profileId) {
    const { data } = await sb.from('businesses').select('id, name, email, owner_id, status').eq('owner_id', profileId).maybeSingle()
    bizByOwnerId = data
  }
  const { data: bizByEmail } = await sb.from('businesses').select('id, name, email, owner_id, status').eq('email', email).maybeSingle()

  return NextResponse.json({
    email,
    authUser: authUser ? {
      id: authUser.id,
      email: authUser.email,
      email_confirmed_at: authUser.email_confirmed_at,
      created_at: authUser.created_at,
    } : null,
    usersRowByAuthId: usersRow,
    usersRowByEmail,
    profileIdUsed: profileId ?? null,
    bizByOwnerId,
    bizByEmail,
    diagnosis: {
      authUserExists: !!authUser,
      usersRowExists: !!(usersRow || usersRowByEmail),
      authIdLinked: !!usersRow,
      authIdMismatch: !usersRow && !!usersRowByEmail,
      bizExists: !!(bizByOwnerId || bizByEmail),
      bizOwnerIdLinked: !!bizByOwnerId,
      bizEmailMismatch: !bizByOwnerId && !!bizByEmail,
      emailInBiz: bizByEmail?.email ?? null,
    }
  })
}
