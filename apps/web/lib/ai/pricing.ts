// Phase B — hand-maintained $/token estimates for AI cost tracking.
//
// These are NOT pulled from a live pricing API — Anthropic doesn't publish
// one, and these model ids (claude-fable-5, claude-opus-4-8, etc.) are too
// new for any third-party pricing dataset to resolve. Figures below are
// placeholder estimates in the same ballpark as Anthropic's publicly listed
// per-model tiers; update them to match your actual Anthropic invoice once
// you have one. Good enough for relative cost-per-feature comparison and
// spend trends — not for finance reconciliation.
//
// All figures are USD per 1,000,000 tokens.
export const MODEL_PRICING_PER_MILLION_TOKENS: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  'claude-fable-5':            { input: 3,    output: 15,   cacheRead: 0.3,  cacheWrite: 3.75 },
  'claude-opus-4-8':            { input: 15,   output: 75,   cacheRead: 1.5,  cacheWrite: 18.75 },
  'claude-haiku-4-5-20251001':  { input: 0.8,  output: 4,    cacheRead: 0.08, cacheWrite: 1 },
}

// A model id not in the table above (new release, env override) still gets
// logged with real token counts — just priced at this clearly-approximate
// mid-tier rate rather than silently recording $0.
const FALLBACK_PRICING = { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 }

export function estimateCostUsd(model: string, usage?: {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}): number {
  if (!usage) return 0
  const pricing = MODEL_PRICING_PER_MILLION_TOKENS[model] ?? FALLBACK_PRICING
  const cost =
    ((usage.input_tokens ?? 0) / 1_000_000) * pricing.input +
    ((usage.output_tokens ?? 0) / 1_000_000) * pricing.output +
    ((usage.cache_read_input_tokens ?? 0) / 1_000_000) * pricing.cacheRead +
    ((usage.cache_creation_input_tokens ?? 0) / 1_000_000) * pricing.cacheWrite
  return Math.round(cost * 1_000_000) / 1_000_000
}
