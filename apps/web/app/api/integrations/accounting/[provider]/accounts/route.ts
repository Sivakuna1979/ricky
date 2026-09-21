// @ts-nocheck
// L34 — read-only fetch of a connected org's real chart of accounts + tax
// codes, for the mapping dropdown. Refreshes the access token via the same
// getValidAccessToken path the sync engine uses if it's expired.
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { getAccountingTokens, storeAccountingTokens } from '@/lib/integrations/secrets'
import { getXeroAccounts, getXeroTaxRates, getXeroTenants, refreshXeroToken } from '@/lib/accounting/xero'
import { getQuickBooksAccounts, getQuickBooksTaxCodes, refreshQuickBooksToken } from '@/lib/accounting/quickbooks'

export async function GET(req: Request, { params }: { params: { provider: string } }) {
  const provider = params.provider?.toUpperCase()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_integrations')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: connection } = await admin.from('accounting_connections').select('*').eq('business_id', ctx.businessId).eq('provider', provider).eq('status', 'CONNECTED').maybeSingle()
  if (!connection) return NextResponse.json({ error: 'Not connected' }, { status: 404 })

  const tokens = await getAccountingTokens(admin, connection.id)
  if (!tokens) return NextResponse.json({ error: 'Not connected' }, { status: 404 })

  try {
    let accessToken = tokens.access_token
    const expiresAt = tokens.token_expires_at ? new Date(tokens.token_expires_at).getTime() : 0
    if (expiresAt - Date.now() < 60000) {
      const refreshed = provider === 'XERO' ? await refreshXeroToken(tokens.refresh_token) : await refreshQuickBooksToken(tokens.refresh_token)
      await storeAccountingTokens(admin, connection.id, refreshed)
      accessToken = refreshed.accessToken
    }

    if (provider === 'XERO') {
      const tenantId = connection.external_org_id ?? (await getXeroTenants(accessToken))[0]?.tenantId
      const [accounts, taxRates] = await Promise.all([getXeroAccounts(accessToken, tenantId), getXeroTaxRates(accessToken, tenantId)])
      return NextResponse.json({ accounts, tax_codes: taxRates.map((t: any) => ({ id: t.taxType, name: `${t.name} (${t.effectiveRate}%)` })) })
    }
    const [accounts, taxCodes] = await Promise.all([getQuickBooksAccounts(accessToken, connection.external_org_id), getQuickBooksTaxCodes(accessToken, connection.external_org_id)])
    return NextResponse.json({ accounts, tax_codes: taxCodes })
  } catch (e: any) {
    await admin.from('accounting_connections').update({ status: 'ERROR', last_error: 'Could not fetch accounts from the provider.' }).eq('id', connection.id)
    return NextResponse.json({ error: 'Could not fetch accounts from the provider — the connection has been flagged for review.' }, { status: 502 })
  }
}
