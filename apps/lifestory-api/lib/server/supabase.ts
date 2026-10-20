import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let admin: SupabaseClient | null = null

/** Service-role client: bypasses row level security, so only use it after checking who the caller is. */
export function adminClient(): SupabaseClient {
  if (!admin) {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
    admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return admin
}

export const BUCKET = 'lifestory'

export interface FilmRow {
  id: string
  user_id: string
  subject_name: string
  relation: string | null
  occasion: string
  language: string
  voice: string
  format: 'landscape' | 'portrait'
  status: 'draft' | 'scripted' | 'queued' | 'rendering' | 'ready' | 'failed'
  interview: { role: 'assistant' | 'user'; content: string }[]
  script: import('../film/types').FilmScript | null
  progress: number
  video_path: string | null
  poster_path: string | null
  purchase_id: string | null
  script_attempts: number
}

export interface PhotoRow {
  id: string
  film_id: string
  storage_path: string
  position: number
  note: string | null
}
