import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  LayoutDashboard, Radio, Calendar, Lightbulb, FileText, Clapperboard,
  UploadCloud, ListChecks, AlertTriangle, BarChart3, DollarSign, ShieldCheck,
  KeyRound, Settings, Compass,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PauseButton } from '@/components/PauseButton'

const NAV = [
  { href: '/dashboard', label: 'Today', icon: LayoutDashboard },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar },
  { href: '/dashboard/approvals', label: 'Approvals', icon: ShieldCheck },
  { href: '/dashboard/topics', label: 'Topics', icon: Lightbulb },
  { href: '/dashboard/scripts', label: 'Scripts', icon: FileText },
  { href: '/dashboard/videos', label: 'Videos & thumbnails', icon: Clapperboard },
  { href: '/dashboard/uploads', label: 'Uploads', icon: UploadCloud },
  { href: '/dashboard/jobs', label: 'Job history', icon: ListChecks },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/costs', label: 'Costs', icon: DollarSign },
  { href: '/dashboard/niches', label: 'Niche tool', icon: Compass },
  { href: '/dashboard/channels', label: 'Channels', icon: Radio },
  { href: '/dashboard/providers', label: 'Provider settings', icon: KeyRound },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('yt_profiles').select('is_paused').eq('id', user.id).maybeSingle()

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 lg:flex-row">
      <aside className="hidden w-64 flex-col border-r border-neutral-200 bg-white lg:flex">
        <div className="px-5 py-5">
          <div className="text-lg font-bold text-brand">YT Automation</div>
          <div className="mt-1 truncate text-xs text-neutral-500">{user.email}</div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100">
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-neutral-200 px-4 py-4 space-y-3">
          <PauseButton isPaused={!!profile?.is_paused} />
          <form action="/api/auth/signout" method="post">
            <button className="text-xs font-medium text-neutral-600 hover:text-brand">Sign out</button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 lg:hidden">
        <Link href="/dashboard" className="text-lg font-bold text-brand">YT Automation</Link>
        <PauseButton isPaused={!!profile?.is_paused} />
      </header>

      {profile?.is_paused && (
        <div className="bg-red-600 px-4 py-2 text-center text-sm font-medium text-white lg:ml-64">
          Automation is paused — no new videos will be produced or uploaded.
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-4 pb-20 sm:p-6 lg:pb-6">{children}</main>

      {/* Mobile bottom nav — most-used sections only */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-neutral-200 bg-white py-2 lg:hidden">
        {NAV.slice(0, 5).map((item) => (
          <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 px-2 text-neutral-600">
            <item.icon className="h-5 w-5" />
            <span className="text-[10px]">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
