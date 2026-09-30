import Link from 'next/link'
import { SearchBox } from './search-box'
import { getViewer } from '@/lib/auth/viewer'

const NAV = [
  { href: '/company/AAPL', label: 'Research' },
  { href: '/screener', label: 'Screener' },
  { href: '/compare', label: 'Compare' },
  { href: '/assistant', label: 'Ask AI' },
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/backtest', label: 'Backtest' },
  { href: '/academy', label: 'Academy' },
  { href: '/methodology', label: 'Methodology' },
]

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Evidentia home">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect x="1" y="1" width="30" height="30" rx="8" fill="#121b2f" stroke="#2a3a5c" />
        <rect x="8" y="17" width="4" height="8" rx="1" fill="#3987e5" />
        <rect x="14" y="12" width="4" height="13" rx="1" fill="#4c8dff" />
        <rect x="20" y="7" width="4" height="18" rx="1" fill="#2fbf71" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight text-fg">Evidentia</span>
      <span className="hidden rounded border border-ink-600 px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-fg-3 sm:inline">Research</span>
    </Link>
  )
}

export async function SiteHeader() {
  const viewer = await getViewer()
  return (
    <header className="sticky top-0 z-40 border-b border-ink-700/80 bg-ink-950/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="scrollbar-thin hidden items-center gap-0.5 overflow-x-auto xl:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-2 py-1.5 text-sm text-fg-2 hover:bg-ink-800 hover:text-fg">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto w-full max-w-[220px]">
          <SearchBox />
        </div>
        <Link href={viewer.user ? '/account' : viewer.authConfigured ? '/sign-in' : '/account'} className="btn hidden shrink-0 sm:inline-flex">
          {viewer.user ? 'Account' : viewer.authConfigured ? 'Sign in' : 'Free beta'}
        </Link>
      </div>
      <nav className="scrollbar-thin flex gap-1 overflow-x-auto border-t border-ink-800 px-4 py-1.5 xl:hidden" aria-label="Main mobile">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="shrink-0 rounded-md px-2.5 py-1 text-sm text-fg-2 hover:bg-ink-800">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
