// @ts-nocheck
// L30/L38 — the OAuth callback. Re-derives everything from the stored
// `oauth_states` row (never trusts business/user identity from the query
// string), exchanges the code for tokens server-side, stores them ONLY in
// the secrets table, and writes just the non-secret connection status.
// Always redirects back into the dashboard — never returns a token or any
// part of one in a URL, a redirect location, or a rendered page.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { consumeOAuthState } from '@/lib/integrations/oauth'
import { storeAccountingTokens } from '@/lib/integrations/secrets'
import { exchangeXeroCode, getXeroTenants } from '@/lib/accounting/xero'
import { exchangeQuickBooksCode } from '@/lib/accounting/quickbooks'
import { logAuditEvent } from '@/lib/auditLog'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://food-taxi.vercel.app'
const RETURN_TO = `${APP_URL}/dashboard/integrations`

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider?.toUpperCase()
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const realmId = searchParams.get('realmId') // QuickBooks only

  if (!code || !state) return NextResponse.redirect(`${RETURN_TO}?error=missing_code`)

  const admin = await createAdminClient()
  const stateRow = await consumeOAuthState(admin, state, provider)
  if (!stateRow) return NextResponse.redirect(`${RETURN_TO}?error=invalid_or_expired_state`)

  try {
    const tokens = provider === 'XERO'
      ? await exchangeXeroCode(code, stateRow.redirect_uri)
      : await exchangeQuickBooksCode(code, stateRow.redirect_uri)

    let externalOrgId: string | null = realmId
    let externalOrgName: string | null = null
    if (provider === 'XERO') {
      const tenants = await getXeroTenants(tokens.accessToken)
      externalOrgId = tenants[0]?.tenantId ?? null
      externalOrgName = tenants[0]?.tenantName ?? null
    }

    const { data: connection, error } = await admin.from('accounting_connections').upsert({
      business_id: stateRow.business_id, provider, status: 'CONNECTED',
      external_org_id: externalOrgId, external_org_name: externalOrgName,
      connected_by: stateRow.created_by, connected_at: new Date().toISOString(),
      disconnected_at: null, last_error: null, last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: 'business_id,provider' }).select().single()
    if (error) throw error

    await storeAccountingTokens(admin, connection.id, tokens)
    // L27 — audit the connect event itself, never any token value.
    await logAuditEvent(admin, { actorId: stateRow.created_by, action: 'integrations.accounting_connected', entityType: 'accounting_connections', entityId: connection.id, newValues: { provider, external_org_name: externalOrgName } })

    return NextResponse.redirect(`${RETURN_TO}?connected=${provider.toLowerCase()}`)
  } catch (e: any) {
    return NextResponse.redirect(`${RETURN_TO}?error=connection_failed`)
  }
}
