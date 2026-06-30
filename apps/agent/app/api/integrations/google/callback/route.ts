import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { appUrl } from '@/lib/utils'

// Exchanges the Google OAuth code for tokens and stores them against the
// workspace (passed through `state`).
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const workspaceId = req.nextUrl.searchParams.get('state')
  if (!code || !workspaceId) {
    return NextResponse.redirect(appUrl('/dashboard/settings?error=oauth'))
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: appUrl('/api/integrations/google/callback'),
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) return NextResponse.redirect(appUrl('/dashboard/settings?error=token'))
  const tok = await tokenRes.json()

  // Look up the connected account email.
  let accountEmail: string | null = null
  try {
    const me = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    })
    accountEmail = (await me.json())?.email ?? null
  } catch {
    /* non-fatal */
  }

  const supabase = createAdminClient()
  await supabase.from('integrations').upsert(
    {
      workspace_id: workspaceId,
      provider: 'google',
      access_token: tok.access_token,
      refresh_token: tok.refresh_token ?? null,
      expiry: new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString(),
      scopes: tok.scope ?? null,
      account_email: accountEmail,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id,provider' }
  )

  return NextResponse.redirect(appUrl('/dashboard/settings?google=connected'))
}
