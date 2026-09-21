// @ts-nocheck
// L27 — shared OAuth 2.0 infrastructure for every external connection in
// this phase (accounting now; a payment provider only once one is
// approved). State + PKCE are generated server-side and never trusted from
// the client; the callback re-derives everything from the stored
// `oauth_states` row, never from anything the redirect query string claims
// beyond the opaque `state` value itself.
import { randomBytes, createHash } from 'crypto'

function base64url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const STATE_TTL_MINUTES = 10

export async function createOAuthState(admin: any, params: {
  businessId: string
  userId: string
  providerKind: 'PAYMENT' | 'ACCOUNTING'
  provider: string
  redirectUri: string
  usePkce?: boolean
}) {
  const state = base64url(randomBytes(32))
  const codeVerifier = params.usePkce ? base64url(randomBytes(32)) : null
  const codeChallenge = codeVerifier ? base64url(createHash('sha256').update(codeVerifier).digest()) : null

  const { error } = await admin.from('oauth_states').insert({
    business_id: params.businessId, provider_kind: params.providerKind, provider: params.provider,
    state, code_verifier: codeVerifier, redirect_uri: params.redirectUri, created_by: params.userId,
    expires_at: new Date(Date.now() + STATE_TTL_MINUTES * 60000).toISOString(),
  })
  if (error) throw error

  return { state, codeChallenge }
}

// Consumes (marks used) and returns the stored state row, or null if it's
// missing, expired, or already used — a state can never be replayed.
export async function consumeOAuthState(admin: any, state: string, provider: string) {
  const { data: row } = await admin.from('oauth_states').select('*').eq('state', state).eq('provider', provider).maybeSingle()
  if (!row) return null
  if (row.used_at) return null
  if (new Date(row.expires_at) < new Date()) return null

  const { data: claimed } = await admin.from('oauth_states').update({ used_at: new Date().toISOString() }).eq('id', row.id).is('used_at', null).select('id').maybeSingle()
  if (!claimed) return null // lost a race with a concurrent callback for the same state
  return row
}
