// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isSuperAdmin } from '@/lib/isSuperAdmin'
import AccountHub from '@/components/account/AccountHub'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Account — FoodTaxi' }

// J7 — the customer account hub. Reuses the existing Supabase-auth
// login/register flow (no new auth system) — anyone signed in who isn't
// staff/business/admin lands here. Ordinary guest ordering is completely
// untouched and still requires no account at all (J7).
export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/account')

  if (await isSuperAdmin(supabase, user)) redirect('/admin/dashboard')

  const { data: profile } = await supabase
    .from('users').select('full_name, role, email').eq('auth_id', user.id).maybeSingle()

  const name = profile?.full_name ?? user.email?.split('@')[0] ?? 'there'

  return <AccountHub name={name} email={profile?.email ?? user.email ?? ''} />
}
