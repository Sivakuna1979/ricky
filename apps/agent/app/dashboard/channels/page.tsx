import { getCurrentContext } from '@/lib/workspace'
import { createClient } from '@/lib/supabase/server'
import { getPlan } from '@/lib/plans'
import ChannelManager from '@/components/ChannelManager'
import { appUrl } from '@/lib/utils'
import type { Agent, Channel } from '@/lib/types'

export default async function ChannelsPage() {
  const { workspace } = await getCurrentContext()
  if (!workspace) return null
  const supabase = await createClient()
  const plan = getPlan(workspace.plan)

  const [{ data: channels }, { data: agents }] = await Promise.all([
    supabase.from('channels').select('*').eq('workspace_id', workspace.id).order('created_at'),
    supabase.from('agents').select('*').eq('workspace_id', workspace.id).order('created_at'),
  ])

  const atLimit = (channels?.length ?? 0) >= plan.limits.channels

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Channels</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Connect WhatsApp and Telegram. Your plan allows {plan.limits.channels} channel(s).
      </p>
      {atLimit && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          You’ve reached your channel limit. Upgrade your plan to add more.
        </p>
      )}
      <div className="mt-6">
        <ChannelManager
          channels={(channels ?? []) as Channel[]}
          agents={(agents ?? []) as Agent[]}
          appUrl={appUrl()}
        />
      </div>
    </div>
  )
}
