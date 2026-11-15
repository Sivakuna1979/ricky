import { describe, it, expect } from 'vitest'
import { estimateCostUsd, MODEL_PRICING_PER_MILLION_TOKENS } from '@/lib/ai/pricing'

describe('estimateCostUsd', () => {
  it('returns 0 when there is no usage at all', () => {
    expect(estimateCostUsd('claude-fable-5', undefined)).toBe(0)
  })

  it('prices input and output tokens at the listed per-million rate for a known model', () => {
    const pricing = MODEL_PRICING_PER_MILLION_TOKENS['claude-haiku-4-5-20251001']
    const cost = estimateCostUsd('claude-haiku-4-5-20251001', { input_tokens: 1_000_000, output_tokens: 1_000_000 })
    expect(cost).toBeCloseTo(pricing.input + pricing.output, 6)
  })

  it('includes cache read/write tokens in the estimate', () => {
    const pricing = MODEL_PRICING_PER_MILLION_TOKENS['claude-opus-4-8']
    const cost = estimateCostUsd('claude-opus-4-8', {
      input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 1_000_000,
    })
    expect(cost).toBeCloseTo(pricing.cacheRead + pricing.cacheWrite, 6)
  })

  it('still prices an unknown/future model id instead of returning 0', () => {
    const cost = estimateCostUsd('claude-some-future-model', { input_tokens: 1_000_000, output_tokens: 0 })
    expect(cost).toBeGreaterThan(0)
  })

  it('treats missing token fields as 0 rather than throwing', () => {
    expect(estimateCostUsd('claude-fable-5', {})).toBe(0)
  })
})
