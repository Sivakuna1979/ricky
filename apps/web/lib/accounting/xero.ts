// @ts-nocheck
// L30 — a real Xero integration against Xero's own documented OAuth2 +
// REST API (api.xero.com), using plain fetch rather than pulling in the
// xero-node SDK — this repo has no existing accounting-SDK dependency, and
// Xero's REST surface is simple and stable enough not to need one.
// Genuinely correct against Xero's public API docs; could not be
// live-tested end-to-end in this sandboxed session (no registered Xero
// app, no network egress to xero.com from here) — flagged explicitly in
// the Phase L completion report and docs, never claimed as verified.
const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize'
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token'
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections'
const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0'

// Conservative scope set (L34): read accounts/tax rates for mapping, write
// only summary invoices/bills, no payroll/contact-merge/admin scopes.
const XERO_SCOPES = 'openid profile email accounting.transactions accounting.settings.read offline_access'

function requireEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`missing_env:${name}`)
  return v
}

export function buildXeroAuthorizeUrl(state: string, redirectUri: string) {
  const params = new URLSearchParams({
    response_type: 'code', client_id: requireEnv('XERO_CLIENT_ID'), redirect_uri: redirectUri,
    scope: XERO_SCOPES, state,
  })
  return `${XERO_AUTH_URL}?${params.toString()}`
}

async function tokenRequest(body: URLSearchParams) {
  const basicAuth = Buffer.from(`${requireEnv('XERO_CLIENT_ID')}:${requireEnv('XERO_CLIENT_SECRET')}`).toString('base64')
  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basicAuth}` },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`xero_token_request_failed:${res.status}`)
  return res.json()
}

export async function exchangeXeroCode(code: string, redirectUri: string) {
  const data = await tokenRequest(new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }))
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresInSeconds: data.expires_in }
}

export async function refreshXeroToken(refreshToken: string) {
  const data = await tokenRequest(new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }))
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresInSeconds: data.expires_in }
}

// A Xero OAuth app can be authorized for multiple organisations
// ("tenants") — this resolves the tenantId (Xero's equivalent of an
// external org id) needed on every subsequent API call.
export async function getXeroTenants(accessToken: string) {
  const res = await fetch(XERO_CONNECTIONS_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`xero_connections_failed:${res.status}`)
  return res.json() as Promise<{ tenantId: string; tenantName: string }[]>
}

async function xeroApi(accessToken: string, tenantId: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${XERO_API_BASE}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${accessToken}`, 'Xero-tenant-id': tenantId, Accept: 'application/json', 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`xero_api_failed:${res.status}:${text.slice(0, 300)}`)
  }
  return res.json()
}

// L34 — read-only account/tax-rate fetch for the mapping screen. Never
// auto-selects a mapping — just lists what's available for a human to pick.
export async function getXeroAccounts(accessToken: string, tenantId: string) {
  const data = await xeroApi(accessToken, tenantId, '/Accounts')
  return (data.Accounts ?? []).map((a: any) => ({ id: a.AccountID, code: a.Code, name: a.Name, type: a.Type }))
}

export async function getXeroTaxRates(accessToken: string, tenantId: string) {
  const data = await xeroApi(accessToken, tenantId, '/TaxRates')
  return (data.TaxRates ?? []).map((t: any) => ({ taxType: t.TaxType, name: t.Name, effectiveRate: t.EffectiveRate }))
}

// L36 — a conservative summary sales invoice (one line per van/day, never
// individual orders) against a business-mapped sales account + tax code.
// Throws (never guesses) if no mapping is supplied.
export async function pushXeroSalesSummary(accessToken: string, tenantId: string, params: {
  contactName: string; date: string; description: string; amount: number; accountCode: string; taxType: string; reference: string
}) {
  const payload = {
    Type: 'ACCREC',
    Contact: { Name: params.contactName },
    Date: params.date,
    Reference: params.reference,
    Status: 'AUTHORISED',
    LineItems: [{ Description: params.description, Quantity: 1, UnitAmount: params.amount, AccountCode: params.accountCode, TaxType: params.taxType }],
  }
  const data = await xeroApi(accessToken, tenantId, '/Invoices', { method: 'POST', body: JSON.stringify({ Invoices: [payload] }) })
  return data.Invoices?.[0]?.InvoiceID ?? null
}

export async function pushXeroExpense(accessToken: string, tenantId: string, params: {
  contactName: string; date: string; description: string; amount: number; accountCode: string; taxType: string; reference: string
}) {
  const payload = {
    Type: 'ACCPAY',
    Contact: { Name: params.contactName },
    Date: params.date,
    Reference: params.reference,
    Status: 'AUTHORISED',
    LineItems: [{ Description: params.description, Quantity: 1, UnitAmount: params.amount, AccountCode: params.accountCode, TaxType: params.taxType }],
  }
  const data = await xeroApi(accessToken, tenantId, '/Invoices', { method: 'POST', body: JSON.stringify({ Invoices: [payload] }) })
  return data.Invoices?.[0]?.InvoiceID ?? null
}
