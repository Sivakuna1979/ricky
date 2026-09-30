import Link from 'next/link'
import { authConfigured } from '@/lib/auth/config'
import { SignInForm } from '@/components/auth/sign-in-form'
import { Callout } from '@/components/ui/section'

export const metadata = { title: 'Sign in' }

export default function SignInPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold text-fg">Sign in to Evidentia</h1>
      <p className="mt-1 text-sm text-fg-3">Save watchlists, portfolios and alerts across devices.</p>
      <div className="card card-pad mt-6">
        {authConfigured() ? (
          <SignInForm next={searchParams.next} />
        ) : (
          <div className="space-y-3 text-sm text-fg-2">
            <Callout tone="demo" title="Authentication is not configured in this deployment">
              This instance runs as an open demo: every module is unlocked and your watchlists, portfolios and alerts are saved in this browser only. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable email, Google and Apple sign-in.
            </Callout>
            <div className="flex gap-2">
              <Link href="/watchlist" className="btn btn-primary">
                Open watchlist
              </Link>
              <Link href="/pricing" className="btn">
                See plans
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
