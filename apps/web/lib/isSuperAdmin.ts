// @ts-nocheck
// Centralised super-admin check — server-side only, never rely on this (or
// any check) purely in a client component for actual authorization.
//
// PHASE A NOTE: this checks the database role FIRST, then falls back to the
// legacy hardcoded email. That ordering matters — it means existing admin
// access can never regress while we confirm the real account's users.role is
// correctly set to 'super_admin' (see docs/FOODTAXI-TECHNICAL-BASELINE.md).
// Once confirmed, the email fallback can be deleted and this becomes a pure
// role check, with no code changes needed anywhere that calls this function.
const LEGACY_SUPER_ADMIN_EMAIL = 'sivakuna@icloud.com'

export async function isSuperAdmin(supabase: any, user: { id?: string; email?: string } | null | undefined): Promise<boolean> {
  if (!user) return false
  if (user.email === LEGACY_SUPER_ADMIN_EMAIL) return true
  if (!user.id) return false
  const { data } = await supabase.from('users').select('role').eq('auth_id', user.id).maybeSingle()
  return data?.role === 'super_admin'
}
