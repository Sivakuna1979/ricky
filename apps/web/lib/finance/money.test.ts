import { describe, it, expect } from 'vitest'
import { round2, sum } from '@/lib/finance/money'

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    // 1.005 is actually 1.00499...999 in IEEE754, so it rounds down —
    // a known float caveat of this naive *100/100 approach, not a test typo.
    expect(round2(1.005)).toBe(1)
    expect(round2(1.004)).toBe(1)
    expect(round2(19.999)).toBe(20)
  })

  it('handles negative numbers', () => {
    expect(round2(-4.555)).toBe(-4.55)
  })

  it('treats null/undefined as 0', () => {
    expect(round2(null as unknown as number)).toBe(0)
    expect(round2(undefined as unknown as number)).toBe(0)
  })

  it('leaves whole numbers and already-2dp values unchanged', () => {
    expect(round2(19.99)).toBe(19.99)
    expect(round2(0)).toBe(0)
    expect(round2(100)).toBe(100)
  })
})

describe('sum', () => {
  it('adds a plain array of numbers, rounded', () => {
    expect(sum([1.111, 2.222, 3.333])).toBe(6.67)
  })

  it('treats null/undefined entries as 0 rather than throwing', () => {
    expect(sum([10, null, 5, undefined, 2.5])).toBe(17.5)
  })

  it('returns 0 for an empty array', () => {
    expect(sum([])).toBe(0)
  })

  it('matches round2 for a single value', () => {
    expect(sum([19.995])).toBe(round2(19.995))
  })
})
