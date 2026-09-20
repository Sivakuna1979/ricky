// @ts-nocheck
// Staff directory + invitations (C15, C16). Built on the existing `staff`
// table (20240001_initial_schema.sql) — confirmed unused by any code
// before Phase C — not a new/parallel staff system.
//
// Invitations use Supabase Auth's own inviteUserByEmail: it creates an
// unconfirmed auth user and emails them a secure link to set their own
// password. No shared or hardcoded password is ever created or exposed
// (unlike app/api/admin/fix-user's default-password pattern, which is
// deliberately not reused here).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission, businessRoleToStaffRole, BUSINESS_ROLES } from '@/lib/permissions'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://food-taxi.vercel.app'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const { data, error } = await supabase
    .from('staff').select('*, users(full_name, email), vans(name)').eq('business_id', ctx.businessId).order('invited_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Collapse multi-van rows into one directory entry per person.
  const byUser: Record<string, any> = {}
  for (const row of data ?? []) {
    const entry = byUser[row.user_id] ??= {
      user_id: row.user_id, name: row.users?.full_name, email: row.users?.email,
      role: row.role, is_active: row.is_active, invited_at: row.invited_at, joined_at: row.joined_at,
      staff_ids: [], vans: [], all_vans: false,
    }
    entry.staff_ids.push(row.id)
    entry.is_active = entry.is_active || row.is_active
    if (row.van_id === null) entry.all_vans = true
    else if (row.vans?.name) entry.vans.push(row.vans.name)
  }

  return NextResponse.json(Object.values(byUser))
}

// Body: { email, role: 'BUSINESS_ADMIN'|'VAN_MANAGER'|'DRIVER'|'STAFF', van_ids?: string[] }
// Omit/empty van_ids = access to all vans.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_staff')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const email = (body.email ?? '').trim().toLowerCase()
  const role = body.role
  const vanIds: string[] = Array.isArray(body.van_ids) ? body.van_ids.filter(Boolean) : []
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })
  if (!BUSINESS_ROLES.includes(role) || role === 'OWNER') return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  const staffRole = businessRoleToStaffRole(role)

  const admin = await createAdminClient()

  if (vanIds.length) {
    const { data: vans } = await admin.from('vans').select('id, business_id').in('id', vanIds)
    if ((vans ?? []).length !== vanIds.length || vans.some((v: any) => v.business_id !== ctx.businessId)) {
      return NextResponse.json({ error: 'One or more vans do not belong to this business' }, { status: 403 })
    }
  }

  // Find or create the account. Prefer looking the person up first —
  // inviteUserByEmail errors if they already have an account anywhere on
  // FoodTaxi (e.g. they own another business, or already work elsewhere).
  let { data: existingUser } = await admin.from('users').select('id').eq('email', email).maybeSingle()

  if (existingUser) {
    const { data: alreadyStaff } = await admin.from('staff').select('id').eq('business_id', ctx.businessId).eq('user_id', existingUser.id).limit(1)
    if (alreadyStaff?.length) {
      return NextResponse.json({ error: 'This person is already staff at this business — use the edit action to change their role or vans.' }, { status: 409 })
    }
  }

  if (!existingUser) {
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${APP_URL}/login`,
      data: { role: staffRole },
    })
    if (inviteErr) return NextResponse.json({ error: inviteErr.message ?? 'Could not send invitation' }, { status: 500 })

    const { data: createdUser, error: userErr } = await admin.from('users').insert({
      auth_id: invited.user.id, email, full_name: email.split('@')[0], role: staffRole,
    }).select('id').single()
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 })
    existingUser = createdUser
  }

  const rowsToInsert = vanIds.length
    ? vanIds.map(vanId => ({ business_id: ctx.businessId, user_id: existingUser.id, van_id: vanId, role: staffRole, is_active: true }))
    : [{ business_id: ctx.businessId, user_id: existingUser.id, van_id: null, role: staffRole, is_active: true }]

  const { data: staffRows, error: staffErr } = await admin.from('staff').insert(rowsToInsert).select()
  if (staffErr) return NextResponse.json({ error: staffErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, staff: staffRows }, { status: 201 })
}
