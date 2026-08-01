import { google } from 'googleapis'
import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptSecret, encryptSecret } from '@/lib/crypto'

// Scopes required to run the full pipeline: upload + manage videos,
// manage playlists, and read channel analytics. We deliberately do NOT
// request the broad "manage account" scope — only what's needed.
export const YOUTUBE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
]

function redirectUri() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'
  return `${appUrl}/api/youtube/oauth/callback`
}

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error(
      'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set. Follow GOOGLE_CLOUD_SETUP.md to create ' +
        'an OAuth client in Google Cloud Console before connecting a channel.'
    )
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri())
}

export function buildAuthUrl(state: string) {
  const client = getOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline', // required to receive a refresh_token
    prompt: 'consent', // force refresh_token on every connect, not just the first
    scope: YOUTUBE_OAUTH_SCOPES,
    state,
  })
}

export interface StoredChannelTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  scopes: string[]
}

export async function exchangeCodeForTokens(code: string): Promise<StoredChannelTokens> {
  const client = getOAuthClient()
  const { tokens } = await client.getToken(code)
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error(
      'Google did not return a refresh_token. This usually means the channel was already ' +
        'connected once before — revoke access at myaccount.google.com/permissions and reconnect.'
    )
  }
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(tokens.expiry_date ?? Date.now() + 55 * 60 * 1000),
    scopes: (tokens.scope || '').split(' ').filter(Boolean),
  }
}

export function encryptTokens(tokens: StoredChannelTokens) {
  const access = encryptSecret(tokens.accessToken)
  const refresh = encryptSecret(tokens.refreshToken)
  return {
    oauth_access_token_encrypted: access.ciphertext,
    oauth_access_token_iv: access.iv,
    oauth_access_token_tag: access.authTag,
    oauth_refresh_token_encrypted: refresh.ciphertext,
    oauth_refresh_token_iv: refresh.iv,
    oauth_refresh_token_tag: refresh.authTag,
    oauth_token_expires_at: tokens.expiresAt.toISOString(),
    granted_scopes: tokens.scopes,
  }
}

interface ChannelRow {
  id: string
  oauth_access_token_encrypted: string
  oauth_access_token_iv: string
  oauth_access_token_tag: string
  oauth_refresh_token_encrypted: string
  oauth_refresh_token_iv: string
  oauth_refresh_token_tag: string
  oauth_token_expires_at: string
}

// Returns an authenticated OAuth2 client for a stored channel, refreshing
// (and persisting) the access token first if it's expired or expiring soon.
export async function getAuthorizedClientForChannel(supabase: SupabaseClient, channel: ChannelRow) {
  const client = getOAuthClient()
  const refreshToken = decryptSecret({
    ciphertext: channel.oauth_refresh_token_encrypted,
    iv: channel.oauth_refresh_token_iv,
    authTag: channel.oauth_refresh_token_tag,
  })

  const expiresAt = new Date(channel.oauth_token_expires_at).getTime()
  const needsRefresh = expiresAt - Date.now() < 5 * 60 * 1000

  if (!needsRefresh) {
    const accessToken = decryptSecret({
      ciphertext: channel.oauth_access_token_encrypted,
      iv: channel.oauth_access_token_iv,
      authTag: channel.oauth_access_token_tag,
    })
    client.setCredentials({ access_token: accessToken, refresh_token: refreshToken })
    return client
  }

  client.setCredentials({ refresh_token: refreshToken })
  const { credentials } = await client.refreshAccessToken()
  if (!credentials.access_token) {
    throw new Error('Failed to refresh YouTube OAuth access token — the channel may need reconnecting.')
  }
  client.setCredentials(credentials)

  const encryptedAccess = encryptSecret(credentials.access_token)
  await supabase
    .from('yt_channels')
    .update({
      oauth_access_token_encrypted: encryptedAccess.ciphertext,
      oauth_access_token_iv: encryptedAccess.iv,
      oauth_access_token_tag: encryptedAccess.authTag,
      oauth_token_expires_at: new Date(credentials.expiry_date ?? Date.now() + 55 * 60 * 1000).toISOString(),
      status: 'active',
    })
    .eq('id', channel.id)

  return client
}
