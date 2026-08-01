import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptSecret, encryptSecret } from '@/lib/crypto'
import type { ProviderType } from '@/lib/types'

// Generic secret-holder shape. Most providers only need an `apiKey`, but
// some (e.g. self-hosted TTS) also need a base URL or model override.
export interface ProviderSecret {
  apiKey: string
  baseUrl?: string
  model?: string
  voiceId?: string
  extra?: Record<string, string>
}

export async function saveProviderCredential(
  supabase: SupabaseClient,
  userId: string,
  providerType: ProviderType,
  providerName: string,
  secret: ProviderSecret
) {
  const { ciphertext, iv, authTag } = encryptSecret(JSON.stringify(secret))
  const { error } = await supabase.from('yt_api_credentials').upsert(
    {
      user_id: userId,
      provider_type: providerType,
      provider_name: providerName,
      encrypted_payload: ciphertext,
      iv,
      auth_tag: authTag,
      is_active: true,
    },
    { onConflict: 'user_id,provider_type,provider_name' }
  )
  if (error) throw error
}

export async function getProviderCredential(
  supabase: SupabaseClient,
  userId: string,
  providerType: ProviderType,
  providerName: string
): Promise<ProviderSecret | null> {
  const { data, error } = await supabase
    .from('yt_api_credentials')
    .select('encrypted_payload, iv, auth_tag, is_active')
    .eq('user_id', userId)
    .eq('provider_type', providerType)
    .eq('provider_name', providerName)
    .maybeSingle()

  if (error) throw error
  if (!data || !data.is_active) return null

  const json = decryptSecret({
    ciphertext: data.encrypted_payload,
    iv: data.iv,
    authTag: data.auth_tag,
  })
  return JSON.parse(json) as ProviderSecret
}

export async function listConfiguredProviders(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('yt_api_credentials')
    .select('id, provider_type, provider_name, is_active, last_validated_at, last_validation_error, updated_at')
    .eq('user_id', userId)
    .order('provider_type')
  if (error) throw error
  return data
}

export async function deleteProviderCredential(supabase: SupabaseClient, userId: string, id: string) {
  const { error } = await supabase.from('yt_api_credentials').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}
