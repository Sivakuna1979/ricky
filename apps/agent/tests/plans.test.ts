import { describe, it, expect } from 'vitest'
import { PLANS, getPlan } from '@/lib/plans'

describe('plans', () => {
  it('has the four expected tiers', () => {
    expect(Object.keys(PLANS).sort()).toEqual(['business', 'free', 'pro', 'starter'])
  })

  it('pro plan matches the pricing card features', () => {
    const pro = PLANS.pro
    expect(pro.limits.voice).toBe(true)
    expect(pro.limits.googleWorkspace).toBe(true)
    expect(pro.limits.imageGeneration).toBe(true)
    expect(pro.limits.historyDays).toBe(90)
    expect(pro.limits.prioritySupport).toBe(true)
  })

  it('limits increase across tiers', () => {
    expect(PLANS.free.limits.monthlyMessages).toBeLessThan(PLANS.starter.limits.monthlyMessages)
    expect(PLANS.starter.limits.monthlyMessages).toBeLessThan(PLANS.pro.limits.monthlyMessages)
    expect(PLANS.pro.limits.monthlyMessages).toBeLessThanOrEqual(PLANS.business.limits.monthlyMessages)
  })

  it('getPlan falls back to free for unknown/empty input', () => {
    expect(getPlan(null).id).toBe('free')
    expect(getPlan('nonsense').id).toBe('free')
    expect(getPlan('pro').id).toBe('pro')
  })

  it('only paid plans carry a Stripe price env binding', () => {
    expect(PLANS.free.stripePriceEnv).toBeUndefined()
    expect(PLANS.pro.stripePriceEnv).toBeTruthy()
  })
})
