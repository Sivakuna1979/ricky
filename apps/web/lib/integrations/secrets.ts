// @ts-nocheck
// L27 — the only file that ever writes a real OAuth token to the database.
// Tokens live in `accounting_secrets`/`payment_provider_secrets`, tables
// with RLS enabled and ZERO client-role policies (see the Phase L
// migration) — only this server-side admin-client code path can read or
// write them. No API route ever selects these tables directly or returns
// their contents in a JSON response; every other file in this phase deals
// only with the non-secret `*_connections` tables.
export async function storeAccountingTokens(admin: any, connectionId: string, tokens: { accessToken: string; refreshToken?: string | null; expiresInSeconds: number }) {
  await admin.from('accounting_secrets').upsert({
    connection_id: connectionId,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken ?? undefined,
    token_expires_at: new Date(Date.now() + tokens.expiresInSeconds * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'connection_id' })
}

export async function getAccountingTokens(admin: any, connectionId: string) {
  const { data } = await admin.from('accounting_secrets').select('access_token, refresh_token, token_expires_at').eq('connection_id', connectionId).maybeSingle()
  return data ?? null
}

export async function deleteAccountingTokens(admin: any, connectionId: string) {
  await admin.from('accounting_secrets').delete().eq('connection_id', connectionId)
}

export async function storePaymentProviderTokens(admin: any, connectionId: string, tokens: { accessToken: string; refreshToken?: string | null; expiresInSeconds: number }) {
  await admin.from('payment_provider_secrets').upsert({
    connection_id: connectionId,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken ?? undefined,
    token_expires_at: new Date(Date.now() + tokens.expiresInSeconds * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'connection_id' })
}

export async function deletePaymentProviderTokens(admin: any, connectionId: string) {
  await admin.from('payment_provider_secrets').delete().eq('connection_id', connectionId)
}
