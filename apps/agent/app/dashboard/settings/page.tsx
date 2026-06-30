import { getCurrentContext } from '@/lib/workspace'
import { createClient } from '@/lib/supabase/server'
import { CheckCircle2 } from 'lucide-react'

export default async function SettingsPage() {
  const { workspace } = await getCurrentContext()
  if (!workspace) return null
  const supabase = await createClient()
  const { data: google } = await supabase
    .from('integrations')
    .select('account_email')
    .eq('workspace_id', workspace.id)
    .eq('provider', 'google')
    .maybeSingle()

  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID)

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="card mt-6">
        <h2 className="font-semibold">Workspace</h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-neutral-500">Name</dt>
          <dd>{workspace.name}</dd>
          <dt className="text-neutral-500">Plan</dt>
          <dd className="capitalize">{workspace.plan}</dd>
        </dl>
      </div>

      <div className="card mt-6">
        <h2 className="font-semibold">Google Workspace</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Connect Gmail, Calendar, Sheets and Drive so your agent can act on your behalf.
        </p>
        {google ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" /> Connected as {google.account_email ?? 'Google account'}
          </div>
        ) : googleConfigured ? (
          <a href="/api/integrations/google/start" className="btn-primary mt-3 inline-flex">
            Connect Google
          </a>
        ) : (
          <p className="mt-3 text-sm text-amber-700">
            Google OAuth is not configured on this deployment (set GOOGLE_CLIENT_ID / SECRET).
          </p>
        )}
      </div>
    </div>
  )
}
