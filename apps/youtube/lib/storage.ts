import { createAdminClient } from '@/lib/supabase/server'

// The `media` and `music-library` Supabase Storage buckets are private
// (see supabase/migrations/20240043_youtube_storage_buckets.sql) — nothing
// is served directly from a public URL. Dashboard pages first load the row
// through the normal RLS-scoped client (proving the current user owns it),
// then call this helper with the admin client to mint a short-lived signed
// URL just for that preview.
export async function getSignedMediaUrl(path: string | null, expiresInSeconds = 600): Promise<string | null> {
  if (!path) return null
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from('media').createSignedUrl(path, expiresInSeconds)
  if (error) return null
  return data.signedUrl
}
