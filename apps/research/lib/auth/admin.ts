import { createClient } from '@supabase/supabase-js'

/** Service-role Supabase client — server-only, bypasses RLS. Used by webhooks and cron jobs. */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}
