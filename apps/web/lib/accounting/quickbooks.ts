// @ts-nocheck
// L38 — QuickBooks Online, built to the exact same connector shape as
// lib/accounting/xero.ts (L38's own requirement: "an equivalent
// provider-neutral architecture... a real connector if credentials/
// feasibility allow"). Plain fetch against Intuit's documented OAuth2 +
// REST API, no SDK dependency, for the same reason as Xero. Same caveat:
// genuinely correct against Intuit's public docs, not live-tested in this
// sandboxed session (no registered Intuit app, no egress here).
const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const QB_SCOPES = 'com.intuit.quickbooks.accounting'

function requireEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`missing_env:${name}`)
  return v
}

function apiBase() {
  // QUICKBOOKS_ENVIRONMENT=production switches off the sandbox host —
  // defaults to sandbox so a misconfigured env var can never accidentally
  // write to a live accounting org.
  return process.env.QUICKBOOKS_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com/v3/company'
    : 'https://sandbox-quickbooks.api.intuit.com/v3/company'
}

export function buildQuickBooksAuthorizeUrl(state: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: requireEnv('QUICKBOOKS_CLIENT_ID'), response_type: 'code', scope: QB_SCOPES,
    redirect_uri: redirectUri, state,
  })
  return `${QB_AUTH_URL}?${params.toString()}`
}

async function tokenRequest(body: URLSearchParams) {
  const basicAuth = Buffer.from(`${requireEnv('QUICKBOOKS_CLIENT_ID')}:${requireEnv('QUICKBOOKS_CLIENT_SECRET')}`).toString('base64')
  const res = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', Authorization: `Basic ${basicAuth}` },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`quickbooks_token_request_failed:${res.status}`)
  return res.json()
}

export async function exchangeQuickBooksCode(code: string, redirectUri: string) {
  const data = await tokenRequest(new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }))
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresInSeconds: data.expires_in }
}

export async function refreshQuickBooksToken(refreshToken: string) {
  const data = await tokenRequest(new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }))
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresInSeconds: data.expires_in }
}

async function qbApi(accessToken: string, realmId: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${apiBase()}/${realmId}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`quickbooks_api_failed:${res.status}:${text.slice(0, 300)}`)
  }
  return res.json()
}

export async function getQuickBooksAccounts(accessToken: string, realmId: string) {
  const data = await qbApi(accessToken, realmId, `/query?query=${encodeURIComponent('select * from Account where Active = true')}`)
  return (data.QueryResponse?.Account ?? []).map((a: any) => ({ id: a.Id, name: a.Name, type: a.AccountType }))
}

// QuickBooks Online has no separate "tax code list" endpoint in the same
// shape as Xero's TaxRates — TaxCode is its own entity.
export async function getQuickBooksTaxCodes(accessToken: string, realmId: string) {
  const data = await qbApi(accessToken, realmId, `/query?query=${encodeURIComponent('select * from TaxCode where Active = true')}`)
  return (data.QueryResponse?.TaxCode ?? []).map((t: any) => ({ id: t.Id, name: t.Name }))
}

// L38 — a summary sales receipt / bill, same conservative shape as Xero's
// pushXeroSalesSummary: one line, mapped account + tax code required.
export async function pushQuickBooksSalesSummary(accessToken: string, realmId: string, params: {
  date: string; description: string; amount: number; accountId: string; taxCodeId?: string; reference: string
}) {
  const payload = {
    TxnDate: params.date, DocNumber: params.reference,
    Line: [{ Amount: params.amount, DetailType: 'SalesItemLineDetail', Description: params.description, SalesItemLineDetail: { TaxCodeRef: params.taxCodeId ? { value: params.taxCodeId } : undefined } }],
  }
  const data = await qbApi(accessToken, realmId, '/salesreceipt', { method: 'POST', body: JSON.stringify(payload) })
  return data.SalesReceipt?.Id ?? null
}

export async function pushQuickBooksExpense(accessToken: string, realmId: string, params: {
  date: string; description: string; amount: number; accountId: string; taxCodeId?: string; reference: string
}) {
  const payload = {
    TxnDate: params.date, DocNumber: params.reference,
    Line: [{ Amount: params.amount, DetailType: 'AccountBasedExpenseLineDetail', Description: params.description, AccountBasedExpenseLineDetail: { AccountRef: { value: params.accountId }, TaxCodeRef: params.taxCodeId ? { value: params.taxCodeId } : undefined } }],
  }
  const data = await qbApi(accessToken, realmId, '/purchase', { method: 'POST', body: JSON.stringify(payload) })
  return data.Purchase?.Id ?? null
}
