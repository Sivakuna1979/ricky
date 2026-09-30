/**
 * Plans & entitlements. Checked server-side (route handlers, server components);
 * the UI only mirrors these decisions.
 */
export type Plan = 'free' | 'premium' | 'professional'

export type Feature =
  | 'basic_analysis'
  | 'full_analysis'
  | 'frameworks'
  | 'dcf'
  | 'competitors'
  | 'ai'
  | 'advanced_screener'
  | 'reports'
  | 'watchlists'
  | 'alerts'
  | 'compare'
  | 'advanced_export'
  | 'portfolio_analytics'
  | 'historical_data'
  | 'backtesting'
  | 'api_access'

const RANK: Record<Plan, number> = { free: 0, premium: 1, professional: 2 }

export const FEATURE_MIN_PLAN: Record<Feature, Plan> = {
  basic_analysis: 'free',
  full_analysis: 'premium',
  frameworks: 'premium',
  dcf: 'premium',
  competitors: 'premium',
  ai: 'premium',
  advanced_screener: 'premium',
  reports: 'premium',
  watchlists: 'premium',
  alerts: 'premium',
  compare: 'premium',
  advanced_export: 'professional',
  portfolio_analytics: 'professional',
  historical_data: 'professional',
  backtesting: 'professional',
  api_access: 'professional',
}

export const LIMITS: Record<Plan, { searchesPerDay: number; aiQueriesPerDay: number; screenerFilters: number; portfolios: number }> = {
  free: { searchesPerDay: 15, aiQueriesPerDay: 0, screenerFilters: 3, portfolios: 1 },
  premium: { searchesPerDay: 500, aiQueriesPerDay: 50, screenerFilters: 50, portfolios: 5 },
  professional: { searchesPerDay: 5000, aiQueriesPerDay: 250, screenerFilters: 50, portfolios: 50 },
}

export const PLAN_INFO: Record<Plan, { name: string; price: string; blurb: string; features: string[] }> = {
  free: {
    name: 'Free',
    price: '£0',
    blurb: 'Learn the basics and check the headline evidence.',
    features: ['Basic company data', 'Investment Quality Score & category scores', 'Basic charts', 'Limited searches', 'Investment Academy'],
  },
  premium: {
    name: 'Premium',
    price: '3 months free, then £9.99 / month',
    blurb: 'The full research toolkit for long-term investors. Cancel any time during the trial and you pay nothing.',
    features: ['Full fundamental analysis', 'Investor frameworks', 'Interactive DCF & scenarios', 'Competitor comparison (up to 5)', 'AI research assistant', 'Advanced screener', 'PDF reports', 'Watchlists & alerts'],
  },
  professional: {
    name: 'Professional',
    price: 'Coming soon',
    blurb: 'For serious analysts who need data out and history in.',
    features: ['Everything in Premium', 'Advanced exporting (CSV / JSON)', 'Portfolio analytics', 'Historical datasets', 'Score backtesting', 'More AI queries', 'API access'],
  },
}

export function hasFeature(plan: Plan, feature: Feature): boolean {
  return RANK[plan] >= RANK[FEATURE_MIN_PLAN[feature]]
}

export function isPlan(v: unknown): v is Plan {
  return v === 'free' || v === 'premium' || v === 'professional'
}
