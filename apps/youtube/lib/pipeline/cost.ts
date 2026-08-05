import type { SupabaseClient } from '@supabase/supabase-js'

export class SpendLimitExceededError extends Error {
  constructor(public scope: 'daily' | 'monthly', public limit: number, public spent: number) {
    super(`${scope} spend limit of $${limit.toFixed(2)} reached (already spent $${spent.toFixed(2)}).`)
    this.name = 'SpendLimitExceededError'
  }
}

/**
 * Must be called before starting a new production run (and is re-checked
 * before the upload stage, since rendering can push a run over budget).
 * Throws SpendLimitExceededError if either the daily or monthly cap for
 * the channel owner has been reached — this is the enforcement point for
 * "stop generation when the spending limit is reached".
 */
export async function assertWithinSpendLimits(supabase: SupabaseClient, userId: string) {
  const { data: profile, error } = await supabase
    .from('yt_profiles')
    .select('daily_spend_limit_usd, monthly_spend_limit_usd')
    .eq('id', userId)
    .single()
  if (error) throw error

  const now = new Date()
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [{ data: dailySpend }, { data: monthlySpend }] = await Promise.all([
    supabase.rpc('yt_spend_for_user', { p_user_id: userId, p_since: startOfDay.toISOString() }),
    supabase.rpc('yt_spend_for_user', { p_user_id: userId, p_since: startOfMonth.toISOString() }),
  ])

  const daily = Number(dailySpend ?? 0)
  const monthly = Number(monthlySpend ?? 0)

  if (daily >= profile.daily_spend_limit_usd) {
    throw new SpendLimitExceededError('daily', profile.daily_spend_limit_usd, daily)
  }
  if (monthly >= profile.monthly_spend_limit_usd) {
    throw new SpendLimitExceededError('monthly', profile.monthly_spend_limit_usd, monthly)
  }
}

export async function recordCost(
  supabase: SupabaseClient,
  input: {
    channelId: string
    videoId?: string | null
    topicId?: string | null
    stage:
      | 'research'
      | 'script'
      | 'voiceover'
      | 'image_gen'
      | 'stock_media'
      | 'render'
      | 'thumbnail'
      | 'moderation'
      | 'other'
    provider: string
    estimatedCostUsd: number
    actualCostUsd?: number
    metadata?: Record<string, unknown>
  }
) {
  const { error } = await supabase.from('yt_generation_costs').insert({
    channel_id: input.channelId,
    video_id: input.videoId ?? null,
    topic_id: input.topicId ?? null,
    stage: input.stage,
    provider: input.provider,
    estimated_cost_usd: input.estimatedCostUsd,
    actual_cost_usd: input.actualCostUsd ?? input.estimatedCostUsd,
    metadata: input.metadata ?? {},
  })
  if (error) throw error
}

// Flat per-video estimate shown on the dashboard *before* a production run
// starts, broken down by production mode. Real per-stage costs are
// recorded incrementally via recordCost() as the pipeline runs.
export const PRODUCTION_MODE_ESTIMATES: Record<'low_cost' | 'standard' | 'premium', { short: number; long: number }> = {
  low_cost: { short: 0.35, long: 0.9 },
  standard: { short: 0.7, long: 2.2 },
  premium: { short: 1.4, long: 4.5 },
}
