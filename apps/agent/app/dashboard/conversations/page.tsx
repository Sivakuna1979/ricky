import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { getCurrentContext } from '@/lib/workspace'
import { createClient } from '@/lib/supabase/server'

export default async function ConversationsPage() {
  const { workspace } = await getCurrentContext()
  if (!workspace) return null
  const supabase = await createClient()

  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, last_message_at, status, contacts(name, external_id), channels(name, type)')
    .eq('workspace_id', workspace.id)
    .order('last_message_at', { ascending: false })
    .limit(100)

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Conversations</h1>
      <p className="mt-1 text-sm text-neutral-600">Chats handled by your agents.</p>
      <div className="mt-6 divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {(conversations ?? []).map((c: any) => (
          <Link
            key={c.id}
            href={`/dashboard/conversations/${c.id}`}
            className="flex items-center justify-between px-5 py-3 hover:bg-neutral-50"
          >
            <div>
              <div className="font-medium">
                {c.contacts?.name ?? c.contacts?.external_id ?? 'Unknown'}
              </div>
              <div className="text-xs text-neutral-500">
                {c.channels?.name} · {c.channels?.type}
              </div>
            </div>
            <div className="text-xs text-neutral-400">
              {c.last_message_at
                ? formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })
                : ''}
            </div>
          </Link>
        ))}
        {!conversations?.length && (
          <div className="px-5 py-8 text-center text-sm text-neutral-500">No conversations yet.</div>
        )}
      </div>
    </div>
  )
}
