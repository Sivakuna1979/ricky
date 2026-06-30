import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  LayoutDashboard,
  Bot,
  Radio,
  MessagesSquare,
  BookOpen,
  Clock,
  CreditCard,
  Settings,
  BarChart3,
} from 'lucide-react'
import { getCurrentContext } from '@/lib/workspace'
import { getPlan } from '@/lib/plans'

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/agents', label: 'Agents', icon: Bot },
  { href: '/dashboard/channels', label: 'Channels', icon: Radio },
  { href: '/dashboard/conversations', label: 'Conversations', icon: MessagesSquare },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/knowledge', label: 'Knowledge base', icon: BookOpen },
  { href: '/dashboard/schedules', label: 'Scheduled jobs', icon: Clock },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { workspace, email } = await getCurrentContext()
  if (!workspace) redirect('/login')
  const plan = getPlan(workspace.plan)

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="flex w-60 flex-col border-r border-neutral-200 bg-white">
        <div className="px-5 py-5">
          <div className="text-lg font-bold text-brand">AgentHub</div>
          <div className="mt-1 truncate text-xs text-neutral-500">{workspace.name}</div>
          <span className="mt-2 inline-block rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium capitalize text-brand">
            {plan.name} plan
          </span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-neutral-200 px-5 py-4">
          <div className="truncate text-xs text-neutral-500">{email}</div>
          <form action="/api/auth/signout" method="post">
            <button className="mt-2 text-xs font-medium text-neutral-600 hover:text-brand">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  )
}
