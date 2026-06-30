import { NextResponse } from 'next/server'
import { getCurrentContext } from '@/lib/workspace'
import { GOOGLE_SCOPES } from '@/lib/agent/tools/google'
import { appUrl } from '@/lib/utils'

export async function GET() {
  const { workspace } = await getCurrentContext()
  if (!workspace) return NextResponse.redirect(appUrl('/login'))

  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) return NextResponse.redirect(appUrl('/dashboard/settings?error=google_not_configured'))

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: appUrl('/api/integrations/google/callback'),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES.join(' '),
    state: workspace.id,
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
