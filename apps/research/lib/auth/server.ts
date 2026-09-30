import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { authConfigured } from './config'

/** Server-side Supabase client bound to the request cookies (RLS applies as the signed-in user). */
export function supabaseServer() {
  if (!authConfigured()) return null
  const store = cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options))
        } catch {
          /* called from a server component — middleware refreshes the session instead */
        }
      },
    },
  })
}
