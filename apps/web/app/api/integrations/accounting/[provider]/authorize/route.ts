// @ts-nocheck
// L30/L38 — starts the real Xero/QuickBooks OAuth2 authorization-code
// flow. Redirects the browser straight to the provider's own consent
// screen — this route never sees or stores a token itself, only creates
// the CSRF/PKCE state row the callback will verify.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { createOAuthState } from '@/lib/integrations/oauth'
import { buildXeroAuthorizeUrl } from '@/lib/accounting/xero'
import { buildQuickBooksAuthorizeUrl } from '@/lib/accounting/quickbooks'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://food-taxi.vercel.app'

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider?.toUpperCase()
  if (!['XERO', 'QUICKBOOKS'].includes(provider)) return NextResponse.json({ error: 'Unknown accounting provider' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_accounting_integrations')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const redirectUri = `${APP_URL}/api/integrations/accounting/${provider.toLowerCase()}/callback`

  try {
    const { state } = await createOAuthState(admin, {
      businessId: ctx.businessId, userId: ctx.userId, providerKind: 'ACCOUNTING', provider, redirectUri,
    })
    const authorizeUrl = provider === 'XERO' ? buildXeroAuthorizeUrl(state, redirectUri) : buildQuickBooksAuthorizeUrl(state, redirectUri)
    return NextResponse.redirect(authorizeUrl)
  } catch (e: any) {
    if (String(e.message).startsWith('missing_env')) {
      return NextResponse.json({ error: `${provider} is not configured on this deployment yet (missing ${e.message.split(':')[1]}).` }, { status: 501 })
    }
    return NextResponse.json({ error: 'Could not start the connection.' }, { status: 500 })
  }
}
