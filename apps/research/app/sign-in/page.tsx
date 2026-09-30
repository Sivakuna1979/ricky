import { PlannedModule } from '@/components/layout/planned-module'

export const metadata = { title: 'Sign in' }

export default function Page() {
  return (
    <PlannedModule
      title="Accounts & plans"
      phase="Build phase 10"
      summary="Supabase Auth with email/password, Google and Apple sign-in. Plans gate features server-side."
      scope={[
        'Free — basic company data, basic score, limited searches, basic charts',
        'Premium — full analysis, investor frameworks, DCF, competitors, AI research, advanced screener, reports, watchlists, alerts',
        'Professional — everything in Premium plus advanced exports, portfolio analytics, historical datasets, backtesting, higher AI limits and API access',
      ]}
    />
  )
}
