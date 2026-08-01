import { createClient } from '@/lib/supabase/server'
import { ProfileSettingsForm } from '@/components/ProfileSettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('yt_profiles')
    .select('notification_email, daily_spend_limit_usd, monthly_spend_limit_usd, is_paused, paused_reason')
    .eq('id', user!.id)
    .single()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="card">
        <h2 className="mb-2 font-semibold">Account & spend limits</h2>
        <ProfileSettingsForm
          userId={user!.id}
          initial={{
            notification_email: profile?.notification_email ?? user!.email ?? '',
            daily_spend_limit_usd: Number(profile?.daily_spend_limit_usd ?? 10),
            monthly_spend_limit_usd: Number(profile?.monthly_spend_limit_usd ?? 150),
          }}
        />
      </div>

      {profile?.is_paused && (
        <div className="card border-red-200 bg-red-50">
          <div className="font-medium text-red-800">Automation is paused</div>
          <div className="text-sm text-red-700">{profile.paused_reason}</div>
        </div>
      )}

      <div className="card">
        <h2 className="mb-2 font-semibold">Approval modes</h2>
        <ul className="space-y-2 text-sm text-neutral-700">
          <li><strong>Manual approval</strong> — nothing uploads until you approve the topic, script, video and thumbnail.</li>
          <li><strong>Assisted automation (default)</strong> — everything is generated automatically, then sent to you for final approval before upload.</li>
          <li><strong>Full automation</strong> — publishes automatically, but only when every safety and quality check passes.</li>
        </ul>
        <p className="mt-2 text-sm text-neutral-600">Set the mode per channel on the <a className="text-brand underline" href="/dashboard/channels">Channels</a> page.</p>
      </div>

      <div className="card">
        <h2 className="mb-2 font-semibold">External setup required</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
          <li>Google Cloud OAuth client (GOOGLE_CLIENT_ID/SECRET) — see GOOGLE_CLOUD_SETUP.md</li>
          <li>Provider API keys (AI, TTS, image generation, stock media) — <a className="text-brand underline" href="/dashboard/providers">Provider settings</a></li>
          <li>Licensed music library uploaded to the <code>music-library</code> storage bucket</li>
          <li>Redis instance for the job queue, and the worker process deployed separately (Railway/Render/Cloud Run)</li>
        </ul>
      </div>
    </div>
  )
}
