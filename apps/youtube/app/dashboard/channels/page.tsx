import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ChannelSettingsForm } from '@/components/ChannelSettingsForm'

export default async function ChannelsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const { connected, error } = await searchParams
  const supabase = await createClient()
  const { data: channels } = await supabase
    .from('yt_channels')
    .select('id, title, thumbnail_url, status, is_paused, connected_at, yt_channel_settings(*)')
    .order('connected_at', { ascending: false })
  const { data: niches } = await supabase.from('yt_niches').select('id, name').eq('status', 'active')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Channels</h1>
        <a href="/api/youtube/oauth/start" className="btn-primary">Connect a YouTube channel</a>
      </div>
      {connected && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Channel connected successfully.</p>}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{decodeURIComponent(error)}</p>}

      <p className="text-sm text-neutral-600">
        Connecting uses Google's own consent screen — this app never sees or stores your Google password, only
        an OAuth token scoped to upload, manage and read analytics for the channel you approve.
      </p>

      <div className="space-y-4">
        {channels?.map((c: any) => {
          const settings = Array.isArray(c.yt_channel_settings) ? c.yt_channel_settings[0] : c.yt_channel_settings
          return (
            <div key={c.id} className="card">
              <div className="flex items-center gap-3">
                {c.thumbnail_url && <img src={c.thumbnail_url} alt="" className="h-10 w-10 rounded-full" />}
                <div>
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-neutral-500">{c.status}{c.is_paused ? ' · paused' : ''}</div>
                </div>
              </div>
              {settings && (
                <div className="mt-4 border-t border-neutral-100 pt-4">
                  <ChannelSettingsForm
                    channelId={c.id}
                    niches={niches ?? []}
                    isPaused={c.is_paused}
                    settings={{
                      niche_id: settings.niche_id,
                      upload_pattern: settings.upload_pattern,
                      approval_mode: settings.approval_mode,
                      production_mode: settings.production_mode,
                      slot_time_1: settings.slot_time_1,
                      slot_time_2: settings.slot_time_2,
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
        {!channels?.length && (
          <p className="card text-sm text-neutral-500">
            No channels connected yet. Follow <Link href="/dashboard/settings" className="text-brand underline">GOOGLE_CLOUD_SETUP.md</Link> then click "Connect a YouTube channel".
          </p>
        )}
      </div>
    </div>
  )
}
