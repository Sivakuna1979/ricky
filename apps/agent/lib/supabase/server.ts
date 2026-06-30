import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ANON_KEY

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Called from a Server Component — cookies are read-only here.
        }
      },
    },
  })
}

// Service-role client. Bypasses RLS — use ONLY in trusted server contexts
// (webhooks, cron jobs) where there is no authenticated user session.
export function createAdminClient() {
  return createServerClient(SUPABASE_URL, SERVICE_KEY, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false },
  })
}
