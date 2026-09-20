// @ts-nocheck
// Centralised super-admin check — server-side only, never rely on this (or
// any check) purely in a client component for actual authorization.
//
// Pure database-role check. The legacy hardcoded-email fallback used during
// Phase A (while the real account's users.role was unconfirmed) has been
// removed now that sivakuna@icloud.com is confirmed as role = 'super_admin'
// in the database (see docs/FOODTAXI-TECHNICAL-BASELINE.md §11).
export async function isSuperAdmin(supabase: any, user: { id?: string; email?: string } | null | undefined): Promise<boolean> {
  if (!user?.id) return false
  const { data } = await supabase.from('users').select('role').eq('auth_id', user.id).maybeSingle()
  return data?.role === 'super_admin'
}
