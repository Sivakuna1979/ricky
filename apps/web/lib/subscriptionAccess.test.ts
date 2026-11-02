import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computeHasAccess, trialDaysRemaining, type SubscriptionState } from '@/lib/subscriptionAccess'

describe('computeHasAccess', () => {
  it('denies access when there is no subscription row at all', () => {
    expect(computeHasAccess(null)).toBe(false)
  })

  it('grants access for trialing and active, in that order of likelihood', () => {
    const trialing: SubscriptionState = { status: 'trialing', trial_ends_at: null, current_period_end: null, grandfathered: false }
    const active: SubscriptionState = { status: 'active', trial_ends_at: null, current_period_end: null, grandfathered: false }
    expect(computeHasAccess(trialing)).toBe(true)
    expect(computeHasAccess(active)).toBe(true)
  })

  it('denies access for every non-granting status', () => {
    const statuses = ['past_due', 'cancelled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', null, '']
    for (const status of statuses) {
      const sub: SubscriptionState = { status, trial_ends_at: null, current_period_end: null, grandfathered: false }
      expect(computeHasAccess(sub), `status=${status} should deny access`).toBe(false)
    }
  })

  it('grandfathered always overrides status, including a cancelled subscription', () => {
    const sub: SubscriptionState = { status: 'cancelled', trial_ends_at: null, current_period_end: null, grandfathered: true }
    expect(computeHasAccess(sub)).toBe(true)
  })

  it('grandfathered:false with a denying status still denies', () => {
    const sub: SubscriptionState = { status: 'unpaid', trial_ends_at: null, current_period_end: null, grandfathered: false }
    expect(computeHasAccess(sub)).toBe(false)
  })
})

describe('trialDaysRemaining', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 0 when there is no trial_ends_at', () => {
    expect(trialDaysRemaining(null)).toBe(0)
  })

  it('returns 0 for a trial that already ended', () => {
    expect(trialDaysRemaining('2026-06-10T00:00:00.000Z')).toBe(0)
  })

  it('never returns a negative number for a long-expired trial', () => {
    expect(trialDaysRemaining('2020-01-01T00:00:00.000Z')).toBe(0)
  })

  it('rounds up a partial day so "ends in a few hours" still reads as 1 day left, not 0', () => {
    // 6 hours from the fixed "now" above — rounds up to 1 full day remaining.
    expect(trialDaysRemaining('2026-06-15T18:00:00.000Z')).toBe(1)
  })

  it('counts a full 3-day trial correctly (the actual FOODTAXI_TRIAL_DAYS value)', () => {
    expect(trialDaysRemaining('2026-06-18T12:00:00.000Z')).toBe(3)
  })

  it('handles a far-future trial_ends_at without overflow', () => {
    expect(trialDaysRemaining('2030-01-01T00:00:00.000Z')).toBeGreaterThan(0)
  })
})
