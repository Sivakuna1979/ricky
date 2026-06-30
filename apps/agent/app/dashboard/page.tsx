import Link from 'next/link'
import { Bot, Radio, MessagesSquare, Activity } from 'lucide-react'
import { getCurrentContext } from '@/lib/workspace'
import { getPlan } from '@/lib/plans'
import { createClient } from '@/lib/supabase/server'

export default async function OverviewPage() {
  const { workspace } = await getCurrentContext()
  if (!workspace) return null
  const plan = getPlan(workspace.plan)
  const supabase = await createClient()

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [{ count: agents }, { count: channels }, { count: conversations }, { count: messages }] =
    await Promise.all([
      supabase.from('agents').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
      supabase.from('channels').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
      supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
      supabase
        .from('usage_events')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspace.id)
        .eq('kind', 'message')
        .gte('created_at', monthStart.toISOString()),
    ])

  const stats = [
    { label: 'Agents', value: agents ?? 0, icon: Bot, href: '/dashboard/agents' },
    { label: 'Channels', value: channels ?? 0, icon: Radio, href: '/dashboard/channels' },
    { label: 'Conversations', value: conversations ?? 0, icon: MessagesSquare, href: '/dashboard/conversations' },
    { label: 'Messages this month', value: `${messages ?? 0} / ${plan.limits.monthlyMessages}`, icon: Activity, href: '/dashboard/billing' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold">Overview</h1>
      <p className="mt-1 text-sm text-neutral-600">Welcome back to {workspace.name}.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card hover:shadow-md">
            <s.icon className="h-5 w-5 text-brand" />
            <div className="mt-3 text-2xl font-bold">{s.value}</div>
            <div className="text-sm text-neutral-600">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="card mt-6">
        <h2 className="font-semibold">Get started</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-neutral-700">
          <li>
            Configure your <Link className="text-brand underline" href="/dashboard/agents">agent</Link>’s
            persona and tools.
          </li>
          <li>
            Connect a <Link className="text-brand underline" href="/dashboard/channels">WhatsApp or Telegram channel</Link>.
          </li>
          <li>
            Add documents to your <Link className="text-brand underline" href="/dashboard/knowledge">knowledge base</Link>.
          </li>
          <li>Message your bot — it replies automatically.</li>
        </ol>
      </div>
    </div>
  )
}
