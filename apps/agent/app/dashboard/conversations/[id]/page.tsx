import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCurrentContext } from '@/lib/workspace'
import { createClient } from '@/lib/supabase/server'

export default async function ConversationDetail({ params }: { params: { id: string } }) {
  const { workspace } = await getCurrentContext()
  if (!workspace) return null
  const supabase = await createClient()

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', params.id)
    .order('created_at')

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/conversations" className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-600">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <div className="space-y-3">
        {(messages ?? []).map((m: any) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                m.role === 'assistant'
                  ? 'bg-white text-neutral-900 border border-neutral-200'
                  : 'bg-brand text-white'
              }`}
            >
              {m.media_url && m.media_type === 'image' && (
                <img src={m.media_url} alt="" className="mb-2 max-h-48 rounded-lg" />
              )}
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          </div>
        ))}
        {!messages?.length && <p className="text-sm text-neutral-500">No messages.</p>}
      </div>
    </div>
  )
}
